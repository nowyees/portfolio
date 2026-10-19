import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { edgeShader, downsampleShader } from './AstroTail';
import { createRobotControls, type RobotMetadata, type RobotSelection } from '../../lib/robotControls';

const ranges = (key: string) => key === 'head' ? [{ label: 'Turn', min: -Math.PI / 3, max: Math.PI / 3 }, { label: 'Tilt', min: -Math.PI / 9, max: Math.PI / 9 }]
  : key === 'base' ? [{ label: 'Turn', min: -Math.PI, max: Math.PI }, { label: 'Roll', min: -.35, max: .35 }]
  : key === 'torso' ? [{ label: 'Lean', min: -.22, max: .22 }]
  : key.startsWith('arm_') ? [{ label: 'Lift', min: 0, max: 1 }]
  : key.startsWith('wheel_') ? [{ label: 'Spin', min: -Math.PI * 2, max: Math.PI * 2 }]
  : key.startsWith('rail_') ? [{ label: 'Rail', min: 0, max: 1 }]
  : key.endsWith('_THUMB') ? [{ label: 'Open / curl', min: -1, max: 1 }, { label: 'Rail', min: 0, max: 1 }]
  : [{ label: 'Open / curl', min: -1, max: 1 }];

type Rig = {
  frames: number; paths: Record<string, number[][]>;
  parts: Array<{ name: string; side: string; matrices: number[][] }>;
  covers: Array<{ name: string; count: number; indexCount: number; base: number; indices: number; delta: number; scale: number }>;
};

/** Blender evaluates the constraints and the soft elbow covers together. Scrub those same poses.
 *  No control panel: hovering a movable part draws its lines in red, and dragging (or clicking a hand) moves it.
 *  Double-click resets the pose. */
export default function DualArmIK({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Loading motion…');
  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false, frame = 0, last = 0;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false }); }
    catch { setStatus('3D is unavailable on this device.'); return; }
    renderer.setClearColor(0, 0);
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    // Tight depth range avoids z-fighting on the close CAD shell layers.
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 10);
    camera.position.set(0, .78, 4); camera.lookAt(0, .78, 0);
    // Every mesh draws view normals; a highlighted part draws them with alpha .75, which the edge pass draws bolder.
    // (transparent + NoBlending: opaque materials have their alpha forced to 1, and blending would mix the normals.)
    const normal = new THREE.MeshNormalMaterial(), marked = new THREE.MeshNormalMaterial({ opacity: .75, transparent: true, blending: THREE.NoBlending });
    const target = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1) });
    const lines = new THREE.WebGLRenderTarget(1, 1);
    const edge = new THREE.ShaderMaterial({ ...edgeShader, transparent: true, uniforms: {
      tNormal: { value: target.texture }, tDepth: { value: target.depthTexture },
      texel: { value: new THREE.Vector2() }, near: { value: camera.near }, far: { value: camera.far }, crease: { value: .12 },
    } });
    const down = new THREE.ShaderMaterial({ ...downsampleShader, transparent: true, uniforms: {
      tLines: { value: lines.texture }, pixel: { value: new THREE.Vector2() }, speck: { value: 2.4 },
    } });
    const plane = new THREE.PlaneGeometry(2, 2), quadCamera = new THREE.Camera();
    const edgeScene = new THREE.Scene(), screenScene = new THREE.Scene();
    edgeScene.add(new THREE.Mesh(plane, edge)); screenScene.add(new THREE.Mesh(plane, down));
    let fullFov = 30;
    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2), ratio = dpr * 2;
      renderer.setPixelRatio(dpr); renderer.setSize(w, h);
      target.setSize(Math.round(w * ratio), Math.round(h * ratio)); lines.setSize(Math.round(w * ratio), Math.round(h * ratio));
      edge.uniforms.texel.value.set(1 / (w * ratio), 1 / (h * ratio));
      down.uniforms.pixel.value.set(1 / (w * dpr), 1 / (h * dpr));
      camera.aspect = w / h;
      fullFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(1.02, .95 / camera.aspect) / 4));
      camera.fov = fullFov;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const cursor = document.createElement('div'); cursor.className = 'astro-cursor'; host.appendChild(cursor);
    const pointer = new THREE.Vector2(), ray = new THREE.Raycaster();
    let pressed = false, dragged = false, selection: RobotSelection | null = null, hovered: RobotSelection | null = null;
    let controls: ReturnType<typeof createRobotControls> | null = null;
    let dragX = 0, dragY = 0, dragValues: number[] = [];
    const selectable: THREE.Object3D[] = [];
    type Part = { object: THREE.Object3D; side: string; poses: Array<{ p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }> };
    type Cover = { mesh: THREE.Mesh; side: string; base: Float32Array; delta: Int16Array; scale: number; shown: number };
    let paths: Record<string, THREE.Vector3[]> = {}, parts: Part[] = [], covers: Cover[] = [];
    const current: Record<string, number> = { L: 0, R: 0 };
    // The meshes that move together with a part: a hand brings its fingers and thumb rail; the thumb and its rail go
    // together, since clicking either slides the thumb along the rail.
    const belongs = (key: string | undefined, part: RobotSelection) => {
      const side = part.split('_')[1], thumbGroup = [`finger_${side}_THUMB`, `rail_${side}`];
      return key === part
        || part.startsWith('hand_') && (key?.startsWith(`finger_${side}_`) || key === `rail_${side}`)
        || thumbGroup.includes(part) && thumbGroup.includes(key || '');
    };
    let shownHighlight: RobotSelection | null | undefined;
    const highlight = (part: RobotSelection | null) => {
      if (part === shownHighlight) return;
      shownHighlight = part;
      for (const object of selectable) {
        const material = part && belongs(object.userData.control, part) ? marked : normal;
        object.traverse(o => { if (o instanceof THREE.Mesh) o.material = material; });
      }
    };
    const change = (key: RobotSelection, channel: number, value: number) => {
      const range = ranges(key)[channel];
      controls?.set(key, channel, THREE.MathUtils.clamp(value, range.min, range.max));
    };
    // Clicking a hand (palm, any finger, the thumb or its rail) steps through three moves in turn: fold the
    // fingers, open them, then turn the thumb round its rail.
    const handStep: Record<string, number> = {};
    const gesture = (side: string) => {
      const step = handStep[side] ?? 0; handStep[side] = (step + 1) % 3;
      if (step === 0) controls?.grip(side, true); else if (step === 1) controls?.grip(side, false); else controls?.toggleFlip(side);
    };
    const locate = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
      pointer.set(x / rect.width * 2 - 1, 1 - y / rect.height * 2);
      cursor.style.transform = `translate(${x}px,${y}px)`;
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(selectable, false)[0];
      if (!hit) return null;
      let key = hit.object.userData.control as RobotSelection;
      if (key === 'head' && controls && controls.upperContent.worldToLocal(hit.point.clone()).y < 1.10) key = 'torso';
      return key;
    };
    const move = (event: PointerEvent) => {
      if (pressed && selection) {
        const dx = event.clientX - dragX, dy = event.clientY - dragY;
        if (!dragged && Math.hypot(dx, dy) < 6) return;
        dragged = true;
        if (selection === 'head') { change(selection, 0, dragValues[0] + dx * .006); change(selection, 1, dragValues[1] + dy * .003); }
        else if (selection === 'base') { change(selection, 0, dragValues[0] + dx * .009); change(selection, 1, dragValues[1] - dy * .002); }
        else if (selection === 'torso') change(selection, 0, dragValues[0] + dy * .003);
        else if (selection.startsWith('arm_')) change(selection, 0, dragValues[0] + (-dy + (selection.endsWith('L') ? dx : -dx) * .4) * .004);
        else if (selection.startsWith('wheel_')) change(selection, 0, dragValues[0] + (dx - dy) * .035);
        else if (selection.startsWith('rail_')) change(selection, 0, dragValues[0] + (dx - dy) * .008);
        else change(selection, 0, dragValues[0] + (dx * .3 - dy) * .012);
        return;
      }
      hovered = locate(event);
      host.style.cursor = hovered ? 'grab' : 'default';
      cursor.classList.toggle('is-shown', !!hovered);
    };
    const start = (event: PointerEvent) => {
      if (!controls || event.button !== 0) return;
      const key = locate(event); selection = key;
      if (!key) return;
      pressed = true; dragged = false; dragX = event.clientX; dragY = event.clientY; dragValues = controls.get(key);
      host.setPointerCapture(event.pointerId); host.style.cursor = 'grabbing';
    };
    const end = (event?: PointerEvent) => {
      if (pressed && !dragged && event?.type === 'pointerup' && Math.hypot(event.clientX - dragX, event.clientY - dragY) < 6 && selection && /^(hand|finger|rail)_/.test(selection)) {
        gesture(selection.split('_')[1]);
      }
      pressed = false; host.style.cursor = hovered ? 'grab' : 'default';
    };
    const leave = () => { if (!pressed) { end(); hovered = null; cursor.classList.remove('is-shown'); } };
    const resetPose = () => { controls?.reset(); for (const side in handStep) delete handStep[side]; };
    host.addEventListener('pointermove', move); host.addEventListener('pointerdown', start); host.addEventListener('dblclick', resetPose);
    host.addEventListener('pointerup', end); host.addEventListener('pointercancel', end); host.addEventListener('pointerleave', leave);
    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const abort = new AbortController();
    const disposeModel = (model: THREE.Object3D) => model.traverse(o => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.forEach(m => m.dispose()); }
    });
    const read = async (url: string, compressed = false) => {
      const r = await fetch(url, { signal: abort.signal }); if (!r.ok || !r.body) throw new Error(`Could not load ${url}`);
      return compressed ? new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : r.json();
    };
    Promise.all([loader.loadAsync('/lab/dual-arm-rig.glb'), fetch('/lab/dual-arm-rig.json', { signal: abort.signal }).then(r => {
      if (!r.ok) throw new Error('Rig unavailable'); return r.json() as Promise<Rig>;
    }), fetch('/lab/dual-arm-covers.bin', { signal: abort.signal }).then(async r => {
      if (!r.ok || !r.body) throw new Error('Cover data unavailable');
      return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }), loader.loadAsync('/lab/robot-controls.glb'), read('/lab/robot-controls.json'), read('/lab/robot-head.bin', true)]).then(([gltf, rig, binary, controlModel, metadata, headBinary]) => {
      if (disposed) { disposeModel(gltf.scene); disposeModel(controlModel.scene); return; }
      controls = createRobotControls(controlModel.scene, metadata as RobotMetadata, headBinary as ArrayBuffer, normal);
      scene.add(controls.root); controls.upperContent.add(gltf.scene);
      // Draw everything with the shared normal material (the loaded materials are never shown).
      scene.traverse(o => {
        if (!(o instanceof THREE.Mesh) || o.material === normal) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); o.material = normal;
      });
      for (const name of ['arms_body', 'arms_hand_L', 'arms_hand_R']) {
        const object = gltf.scene.getObjectByName(name);
        if (object) { object.removeFromParent(); disposeModel(object); }
      }
      selectable.push(...controls.meshes);
      paths = Object.fromEntries(Object.entries(rig.paths).map(([side, values]) => [side, values.map(p => new THREE.Vector3().fromArray(p))]));
      parts = rig.parts.map(part => {
        const side = part.side;
        const object = part.name.startsWith('arms_hand_') ? controls!.hands[side] : gltf.scene.getObjectByName(part.name);
        if (!object) throw new Error(`Missing part: ${part.name}`);
        if (!part.name.startsWith('arms_hand_')) { object.userData.control = `arm_${side}`; selectable.push(object); }
        return { object, side: part.side, poses: part.matrices.map(values => {
          const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
          new THREE.Matrix4().fromArray(values).decompose(p, q, s); return { p, q, s };
        }) };
      });
      covers = rig.covers.map(c => {
        const base = new Float32Array(binary.slice(c.base, c.base + c.count * 12));
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(binary.slice(c.indices, c.indices + c.indexCount * 4)), 1));
        geometry.computeVertexNormals();
        const side = c.name.includes('18_') || c.name.includes('20_') ? 'R' : 'L';
        const mesh = new THREE.Mesh(geometry, normal); mesh.frustumCulled = false; controls!.upperContent.add(mesh);
        mesh.userData.control = `arm_${side}`; selectable.push(mesh);
        return { mesh, side, base, shown: -1,
          delta: new Int16Array(binary.slice(c.delta, c.delta + c.count * 3 * rig.frames * 2)), scale: c.scale };
      });
      setStatus('');
    }).catch(error => { if (!disposed) { console.error('Dual-arm motion:', error); setStatus('Motion could not load. Please refresh.'); } });

    const tick = (now: number) => {
      const dt = Math.min(.04, last ? (now - last) / 1000 : 0); last = now;
      for (const [side, path] of Object.entries(paths)) {
        const desired = (controls?.get(`arm_${side}`)[0] || 0) * (path.length - 1);
        current[side] = THREE.MathUtils.lerp(current[side], desired, 1 - Math.exp(-dt * 6));
      }
      for (const part of parts) {
        const f = current[part.side], i = Math.floor(f), j = Math.min(i + 1, part.poses.length - 1), t = f - i;
        part.object.position.lerpVectors(part.poses[i].p, part.poses[j].p, t);
        part.object.quaternion.slerpQuaternions(part.poses[i].q, part.poses[j].q, t);
        part.object.scale.lerpVectors(part.poses[i].s, part.poses[j].s, t);
      }
      for (const cover of covers) {
        const f = current[cover.side], i = Math.floor(f), j = Math.min(i + 1, paths[cover.side].length - 1), t = f - i;
        if (Math.abs(cover.shown - f) < .0005) continue;
        cover.shown = f;
        const position = cover.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const output = position.array as Float32Array, n = cover.base.length;
        for (let k = 0; k < n; k++) output[k] = cover.base[k] + (cover.delta[i * n + k] * (1 - t) + cover.delta[j * n + k] * t) * cover.scale;
        position.needsUpdate = true; cover.mesh.geometry.computeVertexNormals();
      }
      controls?.update(dt);
      // The part being dragged stays red until released; otherwise the one under the cursor.
      highlight(pressed ? selection : hovered);
      renderer.setRenderTarget(target); renderer.render(scene, camera);
      renderer.setRenderTarget(lines); renderer.render(edgeScene, quadCamera);
      renderer.setRenderTarget(null); renderer.render(screenScene, quadCamera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true; apiRef.current = null; abort.abort(); cancelAnimationFrame(frame); observer.disconnect();
      host.removeEventListener('pointermove', move); host.removeEventListener('pointerdown', start); host.removeEventListener('dblclick', resetPose);
      host.removeEventListener('pointerup', end); host.removeEventListener('pointercancel', end); host.removeEventListener('pointerleave', leave);
      disposeModel(scene); draco.dispose(); normal.dispose(); marked.dispose(); target.dispose(); lines.dispose(); edge.dispose(); down.dispose(); plane.dispose(); renderer.dispose();
      renderer.domElement.remove(); cursor.remove();
    };
  }, []);
  return <div className={`${className || ''} robot-interactive`} role="group" aria-label="Articulated robot. Hover a part to see what moves; drag it to move it, click a hand to fold its fingers, open them, then turn its thumb (one per click); double-click to reset.">
    <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
    {status && <p role="status" className="robot-loading">{status}</p>}
  </div>;
}
