import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { edgeShader, downsampleShader } from './AstroTail';

// Poses baked in Blender by scripts/bake-horse-gait.py, so every knee is bent by the rig's own IK and pole targets.
// Each pose is a matrix per shell, relative to the exported geometry, in the same order as `parts`.
type Gait = {
  parts: string[];
  stand: number[][];
  crouch: number[][];
  walk: { frames: number; poses: number[][][] };
  leap: { reach: number[]; push: number[][][]; flight: number[][]; landing: number[][] };
};
type Pose = { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 };

const WALK = { cadence: .85 };   // walk cycles per second, in place (as on a treadmill)
// Leap: a short crouch, the push-off baked in Blender (body thrown forward and up over planted feet), then the flying
// pose (body level, front legs reaching forward and down, hind legs stretched back) off one side of the screen and back
// in from the other, the landing pose (front legs reaching for the ground) and down where it took off. Seconds, and
// the flight's peak height in model units.
const LEAP = { crouch: .25, push: .2, flight: 1.3, land: .35, climb: .42, tilt: .16 };
// climb: the angle (radians) it flies off at, up and away the way its head points; tilt: the extra nose-up turn of the
// whole figure on the way out (the baked flying pose is already pitched up), so the head points along the path.

/** The HORSE robot walks on the spot and leaps forward on a click, using poses baked from its Blender rig. */
export default function HorseMotion({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const launchRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState('Loading HORSE…');
  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false, frame = 0, last = 0;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false }); }
    catch { setStatus('3D is unavailable on this device.'); return; }
    renderer.setClearColor(0, 0); host.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), modelRoot = new THREE.Group(); scene.add(modelRoot);
    const camera = new THREE.OrthographicCamera(-2.5, 2.5, 1.5, -1.5, 1, 12);
    camera.position.set(0, 0, 6); camera.lookAt(0, 0, 0);
    const normal = new THREE.MeshNormalMaterial(); scene.overrideMaterial = normal;
    const target = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1) });
    const lines = new THREE.WebGLRenderTarget(1, 1);
    // The shared edge shader reconstructs perspective depth; an orthographic camera's depth is linear.
    const edge = new THREE.ShaderMaterial({ ...edgeShader, transparent: true,
      fragmentShader: edgeShader.fragmentShader.replace('near * far / (far - d * (far - near))', 'near + d * (far - near)'),
      uniforms: { tNormal: { value: target.texture }, tDepth: { value: target.depthTexture }, texel: { value: new THREE.Vector2() },
        near: { value: camera.near }, far: { value: camera.far }, crease: { value: .12 } } });
    const down = new THREE.ShaderMaterial({ ...downsampleShader, transparent: true,
      uniforms: { tLines: { value: lines.texture }, pixel: { value: new THREE.Vector2() }, speck: { value: 2.4 } } });
    const plane = new THREE.PlaneGeometry(2, 2), quadCamera = new THREE.Camera();
    const edgeScene = new THREE.Scene(), screenScene = new THREE.Scene();
    edgeScene.add(new THREE.Mesh(plane, edge)); screenScene.add(new THREE.Mesh(plane, down));
    let radius = 1.9, modelScale = 1;
    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2), ratio = dpr * 2;
      renderer.setPixelRatio(dpr); renderer.setSize(w, h);
      target.setSize(Math.round(w * ratio), Math.round(h * ratio)); lines.setSize(Math.round(w * ratio), Math.round(h * ratio));
      edge.uniforms.texel.value.set(1 / (w * ratio), 1 / (h * ratio)); down.uniforms.pixel.value.set(1 / (w * dpr), 1 / (h * dpr));
      // Fit the figure with room for the guide line and caption, even on narrow phones.
      const aspect = w / h, half = Math.max(radius / .76, radius / (.82 * aspect));
      camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
      modelScale = w < 600 ? .72 : .9; modelRoot.scale.setScalar(modelScale);
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const abort = new AbortController(), draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const disposeModel = (object: THREE.Object3D) => object.traverse(o => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); }
    });
    const decompose = (values: number[]): Pose => {
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      new THREE.Matrix4().fromArray(values).decompose(p, q, s); return { p, q, s };
    };
    let shells: THREE.Object3D[] = [], stand: Pose[] = [], crouch: Pose[] = [], walk: Pose[][] = [];
    let push: Pose[][] = [], flying: Pose[] = [], landing: Pose[] = [];
    const reach = new THREE.Vector3();
    Promise.all([loader.loadAsync('/lab/horse.glb'), fetch('/lab/horse-gait.json', { signal: abort.signal }).then(r => {
      if (!r.ok) throw new Error('HORSE poses unavailable'); return r.json() as Promise<Gait>;
    })]).then(([gltf, gait]) => {
      if (disposed) { disposeModel(gltf.scene); return; }
      modelRoot.add(gltf.scene);
      // Normals re-split at 38° (as the other pieces), so only real creases draw.
      gltf.scene.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        const creased = toCreasedNormals(o.geometry, THREE.MathUtils.degToRad(38)); o.geometry.dispose(); o.geometry = creased;
      });
      shells = gait.parts.map(name => {
        const object = gltf.scene.getObjectByName(name); if (!object) throw new Error(`Missing HORSE shell ${name}`);
        object.matrixAutoUpdate = false; return object;
      });
      stand = gait.stand.map(decompose); crouch = gait.crouch.map(decompose);
      walk = gait.walk.poses.map(frame => frame.map(decompose));
      push = gait.leap.push.map(sample => sample.map(decompose));
      flying = gait.leap.flight.map(decompose); landing = gait.leap.landing.map(decompose);
      reach.fromArray(gait.leap.reach);
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      radius = bounds.getBoundingSphere(new THREE.Sphere()).radius; resize();
      setStatus('');
    }).catch(error => { if (!disposed) { console.error('HORSE motion:', error); setStatus('HORSE could not load. Please refresh.'); } });

    // Pose blending: interpolate between neighbouring baked frames, then between standing and walking.
    // (b may be out: slerpQuaternions copies a into out first, so b's rotation is read before that.)
    const qb = new THREE.Quaternion();
    const mix = (a: Pose, b: Pose, t: number, out: Pose) => {
      qb.copy(b.q); out.p.lerpVectors(a.p, b.p, t); out.q.slerpQuaternions(a.q, qb, t); out.s.lerpVectors(a.s, b.s, t); return out;
    };
    const tmpA: Pose = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    const tmpB: Pose = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    const sampleAt = (set: Pose[][], f: number, i: number, out: Pose, loop: boolean) => {
      const n = set.length, k = Math.floor(f), t = f - k;
      const a = loop ? ((k % n) + n) % n : THREE.MathUtils.clamp(k, 0, n - 1), b = loop ? (a + 1) % n : Math.min(a + 1, n - 1);
      return mix(set[a][i], set[b][i], t, out);
    };

    let x = 0, phase = 0, activity = 0;
    let leap: { t: number; from: number; direction: number } | null = null;
    // Off-screen bound in model units: past it the figure is out of view.
    const offEdge = () => (camera.right + radius) / modelScale;
    const ease = (t: number) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
    const fire = () => {
      if (!shells.length || reducedMotion || leap) return;
      leap = { t: 0, from: x, direction: 1 };   // the way it faces (to the right)
    };
    launchRef.current = fire;
    let pressed = false, dragged = false, downX = 0, downY = 0;
    const start = (event: PointerEvent) => {
      if (!shells.length || event.button !== 0 || pressed) return;
      pressed = true; dragged = false; downX = event.clientX; downY = event.clientY; host.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (pressed && Math.hypot(event.clientX - downX, event.clientY - downY) >= 6) dragged = true;
    };
    const end = (event: PointerEvent) => {
      if (pressed && !dragged && event.type === 'pointerup' && Math.hypot(event.clientX - downX, event.clientY - downY) < 6) fire();
      pressed = false;
    };
    host.style.cursor = 'crosshair';
    host.addEventListener('pointerdown', start); host.addEventListener('pointermove', move); host.addEventListener('pointerup', end); host.addEventListener('pointercancel', end);

    const pose: Pose = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    const tick = (now: number) => {
      const dt = document.hidden ? 0 : Math.min(.04, last ? (now - last) / 1000 : 0); last = now;
      if (shells.length) {
        let lift = 0, tilt = 0, rootX = x, mode: 'move' | 'crouch' | 'push' | 'air' | 'land' = 'move', amount = 0;
        if (leap) {
          leap.t += dt;
          const { crouch: c, push: p, flight: f, land: l } = LEAP, t = leap.t, d = leap.direction;
          const edge = offEdge(), landFrom = leap.from - d * reach.x, tan = Math.tan(LEAP.climb);
          if (t < c) { mode = 'crouch'; amount = ease(t / c); rootX = leap.from; }
          else if (t < c + p) { mode = 'push'; amount = ease((t - c) / p); rootX = leap.from; tilt = LEAP.tilt * amount; }
          else if (t < c + p + f) {
            const u = (t - c - p) / f; mode = 'air'; amount = u;
            if (u < .5) {   // out along the diagonal, off the far side of the screen
              const s = u / .5; rootX = leap.from + d * (edge * 1.3 - d * leap.from) * s; lift = Math.abs(rootX - leap.from) * tan; tilt = LEAP.tilt;
            } else {        // back in from the near side, coming down the same slope to the landing spot
              const s = (u - .5) / .5, start = -d * edge * 1.3; rootX = start + (landFrom - start) * s;
              lift = Math.abs(landFrom - rootX) * tan; tilt = -LEAP.climb * (1 - ease((s - .6) / .4)) - .26;
            }
          } else {
            const u = ease((t - c - p - f) / l); mode = 'land'; amount = u;   // the legs gather under the body
            rootX = landFrom + d * reach.x * u; tilt = -.26 * (1 - u);
          }
          if (!reducedMotion) phase = (phase + dt * WALK.cadence) % 1;   // the walk carries on under the landing
          activity = 1;
          if (t >= c + p + f + l) { x = rootX = leap.from; leap = null; mode = 'move'; }
        } else {
          // Always walking on the spot; reduced motion holds a standing pose.
          if (!reducedMotion) phase = (phase + dt * WALK.cadence) % 1;
          activity = reducedMotion ? 0 : THREE.MathUtils.lerp(activity, 1, 1 - Math.exp(-dt * 4));
          rootX = x = 0;
        }
        const walkFrame = phase * walk.length;
        shells.forEach((shell, i) => {
          sampleAt(walk, walkFrame, i, tmpA, true);
          mix(stand[i], tmpA, activity, pose);
          if (mode === 'crouch') mix(pose, crouch[i], amount, pose);
          else if (mode === 'push') mix(crouch[i], sampleAt(push, amount * (push.length - 1), i, tmpB, false), amount, pose);
          else if (mode === 'air') {
            // tuck into the flying pose early, reach for the ground late
            const end = push[push.length - 1][i];
            if (amount < .3) mix(end, flying[i], ease(amount / .3), pose);
            else mix(flying[i], landing[i], ease((amount - .65) / .35), pose);
          } else if (mode === 'land') mix(landing[i], pose, amount, pose);   // straight back into the walk
          shell.matrix.compose(pose.p, pose.q, pose.s);
        });
        modelRoot.position.set(rootX * modelScale, lift * modelScale, 0); modelRoot.rotation.z = tilt;
        host.dataset.motionState = leap ? 'leaping' : 'walking';
      }
      renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.setRenderTarget(lines); renderer.render(edgeScene, quadCamera);
      renderer.setRenderTarget(null); renderer.render(screenScene, quadCamera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true; launchRef.current = null; abort.abort(); cancelAnimationFrame(frame); observer.disconnect();
      host.removeEventListener('pointerdown', start); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', end); host.removeEventListener('pointercancel', end);
      disposeModel(scene); draco.dispose(); normal.dispose(); target.dispose(); lines.dispose(); edge.dispose(); down.dispose(); plane.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div className={`${className || ''} horse-interactive`} role="group" tabIndex={0} aria-label="HORSE, walking on the spot. Click, tap or press Space to make it leap." onKeyDown={event => { if (event.key === ' ' && !event.repeat) { event.preventDefault(); launchRef.current?.(); } }}>
    <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
    {status && <p role="status" className="robot-loading">{status}</p>}
  </div>;
}
