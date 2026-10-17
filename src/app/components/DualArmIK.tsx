import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { edgeShader, downsampleShader } from './AstroTail';

type Rig = {
  frames: number; paths: Record<string, number[][]>;
  parts: Array<{ name: string; side: string; matrices: number[][] }>;
  covers: Array<{ name: string; count: number; indexCount: number; base: number; indices: number; delta: number; scale: number }>;
};

/** Blender evaluates the constraints and the soft elbow covers together. Scrub those same poses. */
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
    const normal = new THREE.MeshNormalMaterial(); scene.overrideMaterial = normal;
    const target = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1) });
    const lines = new THREE.WebGLRenderTarget(1, 1);
    const edge = new THREE.ShaderMaterial({ ...edgeShader, transparent: true, uniforms: {
      tNormal: { value: target.texture }, tDepth: { value: target.depthTexture },
      texel: { value: new THREE.Vector2() }, near: { value: camera.near }, far: { value: camera.far },
    } });
    const down = new THREE.ShaderMaterial({ ...downsampleShader, transparent: true, uniforms: {
      tLines: { value: lines.texture }, pixel: { value: new THREE.Vector2() },
    } });
    const plane = new THREE.PlaneGeometry(2, 2), quadCamera = new THREE.Camera();
    const edgeScene = new THREE.Scene(), screenScene = new THREE.Scene();
    edgeScene.add(new THREE.Mesh(plane, edge)); screenScene.add(new THREE.Mesh(plane, down));
    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5), ratio = dpr * 2;
      renderer.setPixelRatio(dpr); renderer.setSize(w, h);
      target.setSize(Math.round(w * ratio), Math.round(h * ratio)); lines.setSize(Math.round(w * ratio), Math.round(h * ratio));
      edge.uniforms.texel.value.set(1 / (w * ratio), 1 / (h * ratio));
      down.uniforms.pixel.value.set(1 / (w * dpr), 1 / (h * dpr));
      camera.aspect = w / h;
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(1.02, .95 / camera.aspect) / 4));
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const cursor = document.createElement('div'); cursor.className = 'astro-cursor'; host.appendChild(cursor);
    const hint = document.createElement('div'); hint.className = 'astro-hint is-shown';
    hint.innerHTML = '<span class="astro-hint-mark"><i></i></span><span class="astro-hint-label">Move either hand</span>';
    host.appendChild(hint);
    const pointer = new THREE.Vector2(), ray = new THREE.Raycaster();
    const reachPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -.28);
    const goal = new THREE.Vector3();
    let active = '', pressed = false;
    type Part = { object: THREE.Object3D; side: string; poses: Array<{ p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }> };
    type Cover = { mesh: THREE.Mesh; side: string; base: Float32Array; delta: Int16Array; scale: number; shown: number };
    let paths: Record<string, THREE.Vector3[]> = {}, parts: Part[] = [], covers: Cover[] = [];
    const current: Record<string, number> = { L: 0, R: 0 };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && !pressed) return;
      const rect = host.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
      pointer.set(x / rect.width * 2 - 1, 1 - y / rect.height * 2);
      cursor.style.transform = `translate(${x}px,${y}px)`; cursor.classList.add('is-shown');
      ray.setFromCamera(pointer, camera); ray.ray.intersectPlane(reachPlane, goal);
      if (!pressed || !active) active = goal.x >= 0 ? 'L' : 'R';
      hint.classList.remove('is-shown');
    };
    const start = (event: PointerEvent) => { pressed = true; host.setPointerCapture(event.pointerId); move(event); };
    const end = () => { pressed = false; cursor.classList.remove('is-shown'); };
    const leave = () => { if (!pressed) { active = ''; end(); } };
    host.addEventListener('pointermove', move); host.addEventListener('pointerdown', start);
    host.addEventListener('pointerup', end); host.addEventListener('pointercancel', end); host.addEventListener('pointerleave', leave);
    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const abort = new AbortController();
    const disposeModel = (model: THREE.Object3D) => model.traverse(o => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.forEach(m => m.dispose()); }
    });
    Promise.all([loader.loadAsync('/lab/dual-arm-rig.glb'), fetch('/lab/dual-arm-rig.json', { signal: abort.signal }).then(r => {
      if (!r.ok) throw new Error('Rig unavailable'); return r.json() as Promise<Rig>;
    }), fetch('/lab/dual-arm-covers.bin', { signal: abort.signal }).then(async r => {
      if (!r.ok || !r.body) throw new Error('Cover data unavailable');
      return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    })]).then(([gltf, rig, binary]) => {
      if (disposed) { disposeModel(gltf.scene); return; }
      scene.add(gltf.scene);
      paths = Object.fromEntries(Object.entries(rig.paths).map(([side, values]) => [side, values.map(p => new THREE.Vector3().fromArray(p))]));
      parts = rig.parts.map(part => {
        const object = gltf.scene.getObjectByName(part.name);
        if (!object) throw new Error(`Missing part: ${part.name}`);
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
        const mesh = new THREE.Mesh(geometry, normal); mesh.frustumCulled = false; scene.add(mesh);
        return { mesh, side: c.name.includes('18_') || c.name.includes('20_') ? 'R' : 'L', base, shown: -1,
          delta: new Int16Array(binary.slice(c.delta, c.delta + c.count * 3 * rig.frames * 2)), scale: c.scale };
      });
      setStatus('');
    }).catch(error => { if (!disposed) { console.error('Dual-arm motion:', error); setStatus('Motion could not load. Please refresh.'); } });

    const point = new THREE.Vector3(), segment = new THREE.Vector3();
    const tick = (now: number) => {
      const dt = Math.min(.04, last ? (now - last) / 1000 : 0); last = now;
      for (const [side, path] of Object.entries(paths)) {
        let desired = 0, distance = Infinity;
        if (active === side) for (let i = 0; i < path.length - 1; i++) {
          segment.copy(path[i + 1]).sub(path[i]);
          const t = THREE.MathUtils.clamp(point.copy(goal).sub(path[i]).dot(segment) / segment.lengthSq(), 0, 1);
          point.copy(path[i]).addScaledVector(segment, t);
          const d = point.distanceToSquared(goal);
          if (d < distance) { distance = d; desired = i + t; }
        }
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
      if (paths.L) {
        const p = point.copy(paths.L[0]).project(camera);
        hint.style.transform = `translate(${(p.x + 1) * host.clientWidth / 2}px,${(1 - p.y) * host.clientHeight / 2}px)`;
      }
      renderer.setRenderTarget(target); renderer.render(scene, camera);
      renderer.setRenderTarget(lines); renderer.render(edgeScene, quadCamera);
      renderer.setRenderTarget(null); renderer.render(screenScene, quadCamera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true; abort.abort(); cancelAnimationFrame(frame); observer.disconnect();
      host.removeEventListener('pointermove', move); host.removeEventListener('pointerdown', start);
      host.removeEventListener('pointerup', end); host.removeEventListener('pointercancel', end); host.removeEventListener('pointerleave', leave);
      disposeModel(scene); draco.dispose(); normal.dispose(); target.dispose(); lines.dispose(); edge.dispose(); down.dispose(); plane.dispose(); renderer.dispose();
      renderer.domElement.remove(); cursor.remove(); hint.remove();
    };
  }, []);
  return <div className={className} role="img" aria-label="Interactive dual-arm robot. Move the pointer or drag on either side to move its hand."><div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />{status && <p role="status" style={{ position: 'absolute', top: '48%', width: '100%', textAlign: 'center', fontSize: 12, pointerEvents: 'none' }}>{status}</p>}</div>;
}
