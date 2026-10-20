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
  walk: { frames: number; stride: number; poses: number[][][] };
  leap: { samples: number; reach: number[]; poses: number[][][] };
};
type Pose = { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 };

const WALK = { speed: .38, follow: 1.8, stance: .75 };        // top speed (units/s), pursuit gain, stance share of a cycle
// Leap, as when the body controller is dragged forward in Blender: the body pushes off while the feet stay put
// (legs stretching out behind), carries the stretched pose through the air, then the feet catch up as it lands.
const LEAP = { push: .32, flight: .26, land: .42, hop: .18 };

/** The HORSE robot walks after the cursor and leaps forward on a click, using poses baked from its Blender rig. */
export default function HorseMotion({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef(0);
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
    const travel = () => Math.max(.2, camera.right * .85 - radius * modelScale);
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
      targetRef.current = THREE.MathUtils.clamp(targetRef.current, -travel(), travel());
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
    let shells: THREE.Object3D[] = [], stand: Pose[] = [], walk: Pose[][] = [], leapPoses: Pose[][] = [];
    let stride = 1, reach = new THREE.Vector3();
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
      stand = gait.stand.map(decompose);
      walk = gait.walk.poses.map(frame => frame.map(decompose));
      leapPoses = gait.leap.poses.map(sample => sample.map(decompose));
      stride = gait.walk.stride; reach.fromArray(gait.leap.reach);
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      radius = bounds.getBoundingSphere(new THREE.Sphere()).radius; resize();
      setStatus('');
    }).catch(error => { if (!disposed) { console.error('HORSE motion:', error); setStatus('HORSE could not load. Please refresh.'); } });

    // Pose blending: interpolate between neighbouring baked frames, then between standing and walking.
    const mix = (a: Pose, b: Pose, t: number, out: Pose) => {
      out.p.lerpVectors(a.p, b.p, t); out.q.slerpQuaternions(a.q, b.q, t); out.s.lerpVectors(a.s, b.s, t); return out;
    };
    const tmpA: Pose = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    const tmpB: Pose = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    const sampleAt = (set: Pose[][], f: number, i: number, out: Pose, loop: boolean) => {
      const n = set.length, k = Math.floor(f), t = f - k;
      const a = loop ? ((k % n) + n) % n : THREE.MathUtils.clamp(k, 0, n - 1), b = loop ? (a + 1) % n : Math.min(a + 1, n - 1);
      return mix(set[a][i], set[b][i], t, out);
    };

    let x = 0, velocity = 0, phase = 0, activity = 0, heading = 0, facing = 1;
    let leap: { t: number; from: number; direction: number } | null = null;
    const ease = (t: number) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
    const fire = () => {
      if (!shells.length || reducedMotion || leap) return;
      // Leap the way it faces; if there is no room ahead, turn and leap the other way.
      const limit = travel() / modelScale;
      let direction = facing;
      if (Math.abs(x + direction * reach.x) > limit) direction = -direction;
      // Turning round first (the pose holds) keeps the push-off from happening mid-turn.
      leap = { t: direction === facing ? 0 : -.45, from: x, direction }; facing = direction;
    };
    launchRef.current = fire;
    let pressed = false, dragged = false, downX = 0, downY = 0;
    const aim = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      targetRef.current = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width * 2 - 1) * camera.right, -travel(), travel());
    };
    const start = (event: PointerEvent) => {
      if (!shells.length || event.button !== 0 || pressed) return;
      pressed = true; dragged = false; downX = event.clientX; downY = event.clientY; aim(event); host.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (pressed && Math.hypot(event.clientX - downX, event.clientY - downY) >= 6) dragged = true;
      if (event.pointerType === 'mouse' || pressed) aim(event);
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
        const goal = THREE.MathUtils.clamp(targetRef.current, -travel(), travel()) / modelScale;
        let lift = 0, leapAmount = 0, leapWeight = 0, rootX = x;
        if (leap) {
          leap.t += dt;
          const { push, flight, land } = LEAP, t = leap.t;
          // Push: the pose stretches forward (its body moves ahead of its planted feet). Land: it gathers back while
          // the root moves on by the same reach, so the body travels on smoothly and the feet arrive under it.
          leapAmount = t < 0 ? 0 : t < push ? ease(t / push) : t < push + flight ? 1 : 1 - ease((t - push - flight) / land);
          leapWeight = THREE.MathUtils.clamp(t / .1, 0, 1);   // from a walking pose into the leap without a snap
          const carried = t < push + flight ? 0 : ease((t - push - flight) / land);
          rootX = leap.from + leap.direction * reach.x * carried;
          lift = LEAP.hop * Math.sin(Math.PI * THREE.MathUtils.clamp((t - push * .6) / (flight + push * .4 + land * .5), 0, 1));
          activity = Math.max(0, activity - dt * 4); velocity = 0;
          if (t < 0) { rootX = leap.from; lift = 0; }
          if (t >= push + flight + land) { x = rootX = leap.from + leap.direction * reach.x; leap = null; targetRef.current = x * modelScale; }
        } else {
          const wanted = reducedMotion ? 0 : THREE.MathUtils.clamp((goal - x) * WALK.follow, -WALK.speed, WALK.speed);
          velocity = THREE.MathUtils.lerp(velocity, wanted, 1 - Math.exp(-dt * 8));
          if (Math.abs(goal - x) < .004 && Math.abs(velocity) < .01) velocity = 0;
          x += velocity * dt; rootX = x;
          if (Math.abs(velocity) > .03) facing = velocity < 0 ? -1 : 1;
          // One cycle carries the body one stride (feet slide a stride back during the stance share of the cycle).
          phase = (phase + Math.abs(velocity) * dt * WALK.stance / stride) % 1;
          activity = THREE.MathUtils.lerp(activity, THREE.MathUtils.clamp(Math.abs(velocity) * 12, 0, 1), 1 - Math.exp(-dt * 6));
        }
        heading = THREE.MathUtils.lerp(heading, facing < 0 ? Math.PI : 0, 1 - Math.exp(-dt * 7));
        const walkFrame = phase * walk.length, leapSample = leapAmount * (leapPoses.length - 1);
        shells.forEach((shell, i) => {
          sampleAt(walk, walkFrame, i, tmpA, true);
          mix(stand[i], tmpA, activity, pose);
          if (leapWeight > 0) { sampleAt(leapPoses, leapSample, i, tmpB, false); mix(pose, tmpB, leapWeight, pose); }
          shell.matrix.compose(pose.p, pose.q, pose.s);
        });
        modelRoot.position.set(rootX * modelScale, lift * modelScale, 0); modelRoot.rotation.y = heading;
        host.dataset.motionState = leap ? 'leaping' : Math.abs(velocity) > .02 ? 'walking' : 'standing';
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
  return <div className={`${className || ''} horse-interactive`} role="group" tabIndex={0} aria-label="HORSE. Move the cursor to walk; click to leap forward. Keyboard A/D to walk, Space to leap." onKeyDown={event => { if (event.key.toLowerCase() === 'a') targetRef.current -= 1; if (event.key.toLowerCase() === 'd') targetRef.current += 1; if (event.key === ' ' && !event.repeat) { event.preventDefault(); launchRef.current?.(); } }}>
    <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
    {status && <p role="status" className="robot-loading">{status}</p>}
  </div>;
}
