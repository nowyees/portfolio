import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { creasedNormals } from '../../lib/creasedNormals';
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
    // Every hoof is two halves, toe and heel, hinged at the ankle; they ride the ankle but not the shin's tilt.
    // On the ground the hoof sits level (its toe's sole flat; on some legs the model has the hoof tilted as it stands,
    // so level is measured from the sole, not taken as it is modelled). Off it, it tips as one with the stride: the heel lifts as the foot goes back
    // and leaves the ground, and comes down again (a little past level) as it swings forward to land, levelling out
    // as it nears the ground. The ground stops each half on its own: a half that would go through it is turned back
    // about the ankle only as far as it must to rest on it, so the half that lands first bends first.
    let hooves: Array<{ group: number; phase: number; ankle: THREE.Vector3; low: number; lift: number; level: number; ground: number; halves: Array<{ shell: number; outline: THREE.Vector2[] }> }> = [];
    // most the heel lifts as the foot leaves the ground, and drops as it comes down to land (radians)
    const HOOF = { heelUp: .45, heelDown: .15 };
    // where each foot is in the walk cycle when the cycle starts (as baked: the diagonal pairs half a cycle apart)
    const footPhase: Record<string, number> = { 'Bone.007': 0, 'Bone.019': 0, 'Bone.001': .5, 'Bone.014': .5 };
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
        const creased = creasedNormals(o.geometry, THREE.MathUtils.degToRad(38)); o.geometry.dispose(); o.geometry = creased;
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
      // a shell's outline in the side view (convex hull), relative to a point
      const outlineOf = (shell: number, from: THREE.Vector3) => {
        const at = (shells[shell] as THREE.Mesh).geometry.attributes.position;
        const points = Array.from({ length: at.count }, (_, i) => new THREE.Vector2(at.getX(i) - from.x, at.getY(i) - from.y))
          .sort((a, b) => a.x - b.x || a.y - b.y);
        const cross = (o: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        const chain = (list: THREE.Vector2[]) => list.reduce<THREE.Vector2[]>((hull, v) => {
          while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], v) <= 0) hull.pop();
          hull.push(v); return hull;
        }, []).slice(0, -1);
        return [...chain(points), ...chain([...points].reverse())];
      };
      hooves = ['Bone.014', 'Bone.019', 'Bone.001', 'Bone.007'].filter(name => names.includes(name)).map(name => {
        const ankle = new THREE.Vector3().fromArray(rig.bones[name].tail), group = names.indexOf(name), shin = groups[group].shells[0];
        const below = groups[group].shells.filter(i => {
          const geometry = (shells[i] as THREE.Mesh).geometry; geometry.computeBoundingBox();
          // the hoof halves hang from the ankle and reach well below it (the small joint caps just under it, and the
          // shin, which reaches down past it on one front leg, stay on the leg)
          const box = geometry.boundingBox!;
          return box.min.y < ankle.y - .09 && box.max.y < ankle.y + .05;
        });
        groups[group].shells = groups[group].shells.filter(i => !below.includes(i));
        const halves = below.map(shell => ({ shell, outline: outlineOf(shell, ankle) }));
        // Level: the turn that lays the toe half's sole flat: the longest edge along the underside of its outline (the
        // outline runs along the underside heel to toe, then back over the top).
        const toe = halves.reduce((a, b) => Math.max(...b.outline.map(v => v.x)) > Math.max(...a.outline.map(v => v.x)) ? b : a).outline;
        let level = 0, longest = 0;
        toe.forEach((a, i) => {
          const b = toe[(i + 1) % toe.length], slope = Math.atan2(b.y - a.y, b.x - a.x);
          if (b.x > a.x && Math.abs(slope) < .7 && a.distanceTo(b) > longest) { longest = a.distanceTo(b); level = -slope; }
        });
        // The ground: where the sole sits, level, with the ankle as low as it comes in the walk (or standing).
        const heights = gait.walk.poses.map(set => ankle.clone().applyMatrix4(new THREE.Matrix4().fromArray(set[shin])).y);
        const low = Math.min(ankle.y, ...heights), lift = Math.max(...heights) - low;
        const c = Math.cos(level), sn = Math.sin(level);
        const sole = Math.min(...halves.flatMap(h => h.outline.map(v => v.x * sn + v.y * c)));
        return { group, phase: footPhase[name], ankle, low, lift, level, ground: low + sole, halves };
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
    // The hoof's tip through one foot's cycle (q: 0 lands, .5 lifts off, as baked): level through the stance; as the
    // foot leaves the ground going back the heel lifts, then through the swing forward it comes down, past level.
    const tipAt = (q: number) => q < .5 ? 0
      : -HOOF.heelUp * ease((q - .5) / .08) * (1 - ease((q - .62) / .18)) + HOOF.heelDown * ease((q - .75) / .15);
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
    const worlds = Array.from({ length: 16 }, () => new THREE.Matrix4()), pivot = new THREE.Matrix4(), hinge = new THREE.Matrix4(), ankleNow = new THREE.Vector3();
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
        const stride = activity * (mode === 'crouch' ? 1 - amount : 1);
        for (const hoof of hooves) {
          const at = ankleNow.copy(hoof.ankle).applyMatrix4(worlds[hoof.group]);
          // tipped only off the ground, levelling out as the foot comes down to it
          const tip = stride * tipAt((phase + hoof.phase) % 1) * ease((at.y - hoof.low) / (.3 * hoof.lift));
          for (const { shell, outline } of hoof.halves) {
            // how far the half's lowest point is above the ground when turned by `a` about the ankle (+a lowers the heel)
            const above = (a: number) => {
              const c = Math.cos(a), sn = Math.sin(a);
              return at.y + outline.reduce((low, v) => Math.min(low, v.x * sn + v.y * c), Infinity) - hoof.ground;
            };
            // tipped as the hoof is, unless that goes through the ground: then turned back toward level just enough
            const { level } = hoof;
            let angle = level + tip;
            if (above(angle) < 0) {
              if (above(level) < 0) angle = level;
              else {
                let through = angle, clear = level;
                for (let n = 0; n < 16; n++) { const m = (through + clear) / 2; if (above(m) < 0) through = m; else clear = m; }
                angle = clear;
              }
            }
            shells[shell].matrix.makeTranslation(at.x, at.y, at.z).multiply(pivot.makeRotationZ(angle))
              .multiply(hinge.makeTranslation(-hoof.ankle.x, -hoof.ankle.y, -hoof.ankle.z));
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
