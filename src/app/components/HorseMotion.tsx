import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { edgeShader, downsampleShader } from './AstroTail';

type HorseClip = { fps: number; first: number; last: number; bounds: { min: number[]; max: number[] }; parts: Array<{ name: string; poses: number[][] }> };

/** Original HORSE scene-range motion, evaluated in Blender; actual 3D shells, not video. */
export default function HorseMotion({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playingRef = useRef(true);
  const [playing, setPlaying] = useState(true);
  const [status, setStatus] = useState('Loading HORSE…');
  const toggle = () => { playingRef.current = !playingRef.current; setPlaying(playingRef.current); };
  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false, frame = 0, last = 0, elapsed = 0;
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
    // The shared edge shader reconstructs perspective depth. Use its orthographic
    // equivalent here so silhouette/crease thresholds stay stable while orbiting.
    const edge = new THREE.ShaderMaterial({ ...edgeShader, transparent: true,
      fragmentShader: edgeShader.fragmentShader.replace('near * far / (far - d * (far - near))', 'near + d * (far - near)'),
      uniforms: { tNormal: { value: target.texture }, tDepth: { value: target.depthTexture }, texel: { value: new THREE.Vector2() }, near: { value: camera.near }, far: { value: camera.far } } });
    const down = new THREE.ShaderMaterial({ ...downsampleShader, transparent: true,
      uniforms: { tLines: { value: lines.texture }, pixel: { value: new THREE.Vector2() } } });
    const plane = new THREE.PlaneGeometry(2, 2), quadCamera = new THREE.Camera();
    const edgeScene = new THREE.Scene(), screenScene = new THREE.Scene();
    edgeScene.add(new THREE.Mesh(plane, edge)); screenScene.add(new THREE.Mesh(plane, down));
    let radius = 1.9;
    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5), ratio = dpr * 2;
      renderer.setPixelRatio(dpr); renderer.setSize(w, h);
      target.setSize(Math.round(w * ratio), Math.round(h * ratio)); lines.setSize(Math.round(w * ratio), Math.round(h * ratio));
      edge.uniforms.texel.value.set(1 / (w * ratio), 1 / (h * ratio)); down.uniforms.pixel.value.set(1 / (w * dpr), 1 / (h * dpr));
      // Fit a sphere around every authored pose, even after rotation, with room
      // for the guide/header and caption on narrow phones.
      const aspect = w / h, half = Math.max(radius / .76, radius / (.82 * aspect));
      camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    type Pose = { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 };
    let parts: Array<{ object: THREE.Object3D; poses: Pose[] }> = [], clip: HorseClip | null = null;
    const abort = new AbortController(), draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const disposeModel = (object: THREE.Object3D) => object.traverse(o => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); }
    });
    Promise.all([loader.loadAsync('/lab/horse.glb'), fetch('/lab/horse-motion.json', { signal: abort.signal }).then(r => {
      if (!r.ok) throw new Error('HORSE motion unavailable'); return r.json() as Promise<HorseClip>;
    })]).then(([gltf, data]) => {
      if (disposed) { disposeModel(gltf.scene); return; }
      clip = data; modelRoot.add(gltf.scene);
      parts = data.parts.map(part => {
        const object = gltf.scene.getObjectByName(part.name); if (!object) throw new Error('Missing HORSE shell');
        return { object, poses: part.poses.map(matrix => {
          const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); new THREE.Matrix4().fromArray(matrix).decompose(p, q, s); return { p, q, s };
        }) };
      });
      const bounds = new THREE.Box3(new THREE.Vector3().fromArray(data.bounds.min), new THREE.Vector3().fromArray(data.bounds.max));
      radius = bounds.getBoundingSphere(new THREE.Sphere()).radius; resize();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { playingRef.current = false; setPlaying(false); }
      setStatus('');
    }).catch(error => { if (!disposed) { console.error('HORSE motion:', error); setStatus('HORSE could not load. Please refresh.'); } });
    let pressed = false, dragged = false, startX = 0, startY = 0, startYaw = 0, startPitch = 0, yaw = 0, pitch = 0;
    const start = (event: PointerEvent) => {
      if (!clip || event.button !== 0 || pressed) return;
      pressed = true; dragged = false; startX = event.clientX; startY = event.clientY; startYaw = yaw; startPitch = pitch;
      host.setPointerCapture(event.pointerId); host.style.cursor = 'grabbing';
    };
    const move = (event: PointerEvent) => {
      if (!pressed) return;
      const dx = event.clientX - startX, dy = event.clientY - startY;
      if (!dragged && Math.hypot(dx, dy) < 6) return;
      dragged = true; yaw = startYaw + dx * .008; pitch = THREE.MathUtils.clamp(startPitch + dy * .005, -.65, .65);
    };
    const end = (event: PointerEvent) => {
      if (pressed && !dragged && event.type === 'pointerup' && Math.hypot(event.clientX - startX, event.clientY - startY) < 6) toggle();
      pressed = false; host.style.cursor = 'grab';
    };
    host.style.cursor = 'grab';
    host.addEventListener('pointerdown', start); host.addEventListener('pointermove', move); host.addEventListener('pointerup', end); host.addEventListener('pointercancel', end);
    const tick = (now: number) => {
      const dt = Math.min(.04, last ? (now - last) / 1000 : 0); last = now;
      if (playingRef.current && clip && !document.hidden) elapsed += dt;
      if (clip) {
        const count = clip.last - clip.first + 1, f = (elapsed * clip.fps) % count, i = Math.floor(f), j = (i + 1) % count, t = f - i;
        for (const part of parts) { part.object.position.lerpVectors(part.poses[i].p, part.poses[j].p, t); part.object.quaternion.slerpQuaternions(part.poses[i].q, part.poses[j].q, t); part.object.scale.lerpVectors(part.poses[i].s, part.poses[j].s, t); }
      }
      const ease = 1 - Math.exp(-dt * 12); modelRoot.rotation.y = THREE.MathUtils.lerp(modelRoot.rotation.y, yaw, ease); modelRoot.rotation.x = THREE.MathUtils.lerp(modelRoot.rotation.x, pitch, ease);
      renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.setRenderTarget(lines); renderer.render(edgeScene, quadCamera); renderer.setRenderTarget(null); renderer.render(screenScene, quadCamera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true; abort.abort(); cancelAnimationFrame(frame); observer.disconnect();
      host.removeEventListener('pointerdown', start); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', end); host.removeEventListener('pointercancel', end);
      disposeModel(scene); draco.dispose(); normal.dispose(); target.dispose(); lines.dispose(); edge.dispose(); down.dispose(); plane.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div className={`${className || ''} horse-interactive`} role="group" aria-label="HORSE robotic motion. Drag to rotate; click to pause or play.">
    <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
    {status ? <p role="status" className="robot-loading">{status}</p> : <button className="horse-play" type="button" aria-label={playing ? 'Pause HORSE motion' : 'Play HORSE motion'} onClick={toggle}>{playing ? 'Pause' : 'Play'}</button>}
  </div>;
}
