import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { edgeShader, downsampleShader } from './AstroTail';
import { createHorseRunner, type HorseRig } from '../../lib/horseIK';

/** The source HORSE chains solve live foot targets, driven by cursor pursuit. */
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
    let radius = 1.9, modelScale = 1;
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
      modelScale = w < 600 ? .72 : .9; modelRoot.scale.setScalar(modelScale);
      const travel = Math.max(.2, camera.right * .85 - radius * modelScale);
      targetRef.current = THREE.MathUtils.clamp(targetRef.current, -travel, travel);
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    let runner: ReturnType<typeof createHorseRunner> | null = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const abort = new AbortController(), draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const disposeModel = (object: THREE.Object3D) => object.traverse(o => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); }
    });
    Promise.all([loader.loadAsync('/lab/horse.glb'), fetch('/lab/horse-ik.json', { signal: abort.signal }).then(r => {
      if (!r.ok) throw new Error('HORSE IK unavailable'); return r.json() as Promise<HorseRig>;
    })]).then(([gltf, data]) => {
      if (disposed) { disposeModel(gltf.scene); return; }
      modelRoot.add(gltf.scene); runner = createHorseRunner(gltf.scene, data);
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      radius = bounds.getBoundingSphere(new THREE.Sphere()).radius; resize();
      setStatus('');
    }).catch(error => { if (!disposed) { console.error('HORSE motion:', error); setStatus('HORSE could not load. Please refresh.'); } });
    let pressed = false, dragged = false, downX = 0, downY = 0, lastHeading = 0;
    const fire = () => {
      if (!runner || reducedMotion) return;
      // A click launches forward in the direction the figure faces; clicking
      // the rear half of its body must not accidentally reverse the leap.
      const direction = Math.cos(lastHeading) < 0 ? -1 : 1;
      const travel = Math.max(.2, camera.right * .85 - radius * modelScale);
      runner.launch(direction, travel / modelScale);
    };
    launchRef.current = fire;
    const aim = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      const travel = Math.max(.2, camera.right * .85 - radius * modelScale);
      targetRef.current = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width * 2 - 1) * camera.right, -travel, travel);
    };
    const start = (event: PointerEvent) => {
      if (!runner || event.button !== 0 || pressed) return;
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
    const tick = (now: number) => {
      const dt = Math.min(.04, last ? (now - last) / 1000 : 0); last = now;
      if (runner) {
        const travel = Math.max(.2, camera.right * .85 - radius * modelScale);
        targetRef.current = THREE.MathUtils.clamp(targetRef.current, -travel, travel);
        const state = runner.update(document.hidden ? 0 : dt, targetRef.current / modelScale, reducedMotion);
        lastHeading = state.heading;
        if (state.landed) targetRef.current = state.x * modelScale;
        modelRoot.position.set(state.x * modelScale, state.y * modelScale, 0); modelRoot.rotation.y = state.heading;
        host.dataset.motionState = state.leaping ? 'leaping' : Math.abs(state.velocity) > .02 ? 'walking' : 'standing';
        host.dataset.swingingFeet = state.swinging.join(',');
        host.dataset.leapExtension = String(state.stretch);
        host.dataset.ikError = String(Math.max(...Object.values(state.errors)));
      }
      renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.setRenderTarget(lines); renderer.render(edgeScene, quadCamera); renderer.setRenderTarget(null); renderer.render(screenScene, quadCamera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true; launchRef.current = null; abort.abort(); cancelAnimationFrame(frame); observer.disconnect();
      host.removeEventListener('pointerdown', start); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', end); host.removeEventListener('pointercancel', end);
      disposeModel(scene); draco.dispose(); normal.dispose(); target.dispose(); lines.dispose(); edge.dispose(); down.dispose(); plane.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div className={`${className || ''} horse-interactive`} role="group" tabIndex={0} aria-label="HORSE live IK. Move the cursor to walk with crossing strides. Click to launch forward. Keyboard A/D to walk, Space to leap." onKeyDown={event => { if (event.key.toLowerCase() === 'a') targetRef.current -= 1; if (event.key.toLowerCase() === 'd') targetRef.current += 1; if (event.key === ' ' && !event.repeat) { event.preventDefault(); launchRef.current?.(); } }}>
    <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
    {status && <p role="status" className="robot-loading">{status}</p>}
  </div>;
}
