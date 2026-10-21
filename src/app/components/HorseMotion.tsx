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
};
type Rig = { bones: Record<string, { parent: string | null; head: number[]; tail: number[] }>; parts: Array<{ name: string; bone: string }> };
type Pose = { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 };

const WALK = { cadence: .85 };   // walk cycles per second, in place (as on a treadmill)
// A click: the ready pose saved in HORSE.blend, taken over `crouch` seconds, held, then left over `rise`.
const READY = { crouch: 1, hold: 1, rise: 1 };

/** The HORSE robot walks on the spot and, on a click, crouches into its ready pose and rises again, using poses
 *  baked from its Blender rig. */
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
    let shells: THREE.Object3D[] = [], stand: Pose[] = [], crouch: Pose[] = [], walk: Pose[][] = [];
    // Shells ride rigid bones. Poses are blended per bone relative to its parent (the leg roots count as children of
    // the body bone, which they are constrained to), so joints stay together however far apart two poses are.
    // Each bone's pose is kept as its rotation plus where its joint (rest head) sits, so blends turn about the joint.
    let groups: Array<{ parent: number; shells: number[]; head: THREE.Vector3 }> = [];
    // A hind hoof is kept level (it follows its ankle but not the shin's tilt), so it comes down flat. It is two
    // halves, toe and heel, built to spread when they bear weight: as the hoof meets the ground they part, sliding
    // apart along it; lifted, they close up again.
    let hooves: Array<{ group: number; ankle: THREE.Vector3; halves: Array<{ shell: number; side: number }> }> = [];
    const HOOF = { spread: .022, contact: .04 };   // how far each half slides out (units); ankle height of first contact
    Promise.all([loader.loadAsync('/lab/horse.glb'), fetch('/lab/horse-gait.json', { signal: abort.signal }).then(r => {
      if (!r.ok) throw new Error('HORSE poses unavailable'); return r.json() as Promise<Gait>;
    }), fetch('/lab/horse-ik.json', { signal: abort.signal }).then(r => {
      if (!r.ok) throw new Error('HORSE rig unavailable'); return r.json() as Promise<Rig>;
    })]).then(([gltf, gait, rig]) => {
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
      const boneOf = gait.parts.map(name => rig.parts.find(p => p.name === name)!.bone);
      const names = [...new Set(boneOf)], body = 'Bone.026';
      const parentOf = (name: string) => {
        for (let b = rig.bones[name].parent; b; b = rig.bones[b].parent) if (names.includes(b)) return b;
        return name === body ? null : body;
      };
      const depth = (name: string): number => { const p = parentOf(name); return p ? depth(p) + 1 : 0; };
      names.sort((a, b) => depth(a) - depth(b));
      groups = names.map(name => ({ parent: parentOf(name) ? names.indexOf(parentOf(name)!) : -1, shells: boneOf.flatMap((b, i) => b === name ? [i] : []),
        head: new THREE.Vector3().fromArray(rig.bones[name].head) }));
      hooves = ['Bone.014', 'Bone.019'].filter(name => names.includes(name)).map(name => {
        const ankle = new THREE.Vector3().fromArray(rig.bones[name].tail), group = names.indexOf(name);
        const below = groups[group].shells.filter(i => {
          const geometry = (shells[i] as THREE.Mesh).geometry; geometry.computeBoundingBox();
          return geometry.boundingBox!.getCenter(new THREE.Vector3()).y < ankle.y;
        });
        groups[group].shells = groups[group].shells.filter(i => !below.includes(i));
        // the toe half lies ahead of the ankle (+x, the way it faces), the heel half behind
        return { group, ankle, halves: below.map(shell => ({ shell,
          side: (shells[shell] as THREE.Mesh).geometry.boundingBox!.getCenter(new THREE.Vector3()).x > ankle.x ? 1 : -1 })) };
      });
      const world = new THREE.Matrix4(), inv = new THREE.Matrix4();
      const toLocal = (set: number[][]) => {
        const W = groups.map(g => new THREE.Matrix4().fromArray(set[g.shells[0]]));
        return groups.map((g, k) => {
          world.copy(W[k]); if (g.parent >= 0) world.premultiply(inv.copy(W[g.parent]).invert());
          const pose = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }; world.decompose(pose.p, pose.q, pose.s);
          pose.p.copy(g.head).applyMatrix4(world);   // the joint, in the parent's frame
          return pose;
        });
      };
      stand = toLocal(gait.stand); crouch = toLocal(gait.crouch);
      walk = gait.walk.poses.map(toLocal);
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
    const sampleAt = (set: Pose[][], f: number, i: number, out: Pose, loop: boolean) => {
      const n = set.length, k = Math.floor(f), t = f - k;
      const a = loop ? ((k % n) + n) % n : THREE.MathUtils.clamp(k, 0, n - 1), b = loop ? (a + 1) % n : Math.min(a + 1, n - 1);
      return mix(set[a][i], set[b][i], t, out);
    };

    let phase = 0, activity = 0;
    let ready: { t: number } | null = null;
    const ease = (t: number) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
    const fire = () => {
      if (!shells.length || reducedMotion || ready) return;
      ready = { t: 0 };
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
    const worlds = Array.from({ length: 16 }, () => new THREE.Matrix4()), pivot = new THREE.Matrix4(), ankleNow = new THREE.Vector3();
    const tick = (now: number) => {
      const dt = document.hidden ? 0 : Math.min(.04, last ? (now - last) / 1000 : 0); last = now;
      if (shells.length) {
        let mode: 'move' | 'crouch' = 'move', amount = 0;
        if (ready) {
          // a click: lower into the ready pose, hold it, rise back into the walk (which carries on underneath)
          ready.t += dt;
          const { crouch: c, hold: h, rise: r } = READY, t = ready.t;
          mode = 'crouch'; amount = t < c ? ease(t / c) : t < c + h ? 1 : 1 - ease((t - c - h) / r);
          if (!reducedMotion) phase = (phase + dt * WALK.cadence) % 1;
          activity = 1;
          if (t >= c + h + r) { ready = null; mode = 'move'; }
        } else {
          // Always walking on the spot; reduced motion holds a standing pose.
          if (!reducedMotion) phase = (phase + dt * WALK.cadence) % 1;
          activity = reducedMotion ? 0 : THREE.MathUtils.lerp(activity, 1, 1 - Math.exp(-dt * 4));
        }
        const walkFrame = phase * walk.length;
        groups.forEach((group, i) => {
          sampleAt(walk, walkFrame, i, tmpA, true);
          mix(stand[i], tmpA, activity, pose);
          if (mode === 'crouch') mix(pose, crouch[i], amount, pose);
          worlds[i].compose(pose.p, pose.q, pose.s).multiply(pivot.makeTranslation(-group.head.x, -group.head.y, -group.head.z));
          if (group.parent >= 0) worlds[i].premultiply(worlds[group.parent]);
          for (const s of group.shells) shells[s].matrix.copy(worlds[i]);
        });
        for (const hoof of hooves) {
          const at = ankleNow.copy(hoof.ankle).applyMatrix4(worlds[hoof.group]);
          const load = 1 - ease((at.y - hoof.ankle.y) / HOOF.contact);   // 1 on the ground, 0 once lifted clear
          for (const { shell, side } of hoof.halves) {
            const dx = at.x - hoof.ankle.x + side * HOOF.spread * load;
            shells[shell].matrix.makeTranslation(dx, at.y - hoof.ankle.y, at.z - hoof.ankle.z);
          }
        }
        host.dataset.motionState = ready ? 'ready' : 'walking';
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
  return <div className={`${className || ''} horse-interactive`} role="group" tabIndex={0} aria-label="HORSE, walking on the spot. Click, tap or press Space to make it crouch ready and rise again." onKeyDown={event => { if (event.key === ' ' && !event.repeat) { event.preventDefault(); launchRef.current?.(); } }}>
    <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
    {status && <p role="status" className="robot-loading">{status}</p>}
  </div>;
}
