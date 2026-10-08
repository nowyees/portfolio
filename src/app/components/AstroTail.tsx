import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/*
 * Graduation piece: the astronaut held at frame 135 of the Blender scene, its robotic tail alive.
 * Geometry (public/lab/astro-tail.glb): one static mesh for the body + fixed tail mount, and one rigid
 *   mesh per tail bone in rest pose (the skinned hoses are split onto their dominant bones in Blender). Normals are split at 38° in Blender so only real creases draw.
 * Motion: a damped Verlet chain. Every joint is pulled toward the frame-135 shape shifted by the tip's
 *   offset (more strongly toward the tip), then lengths are restored root-to-tip. Lag and overshoot come
 *   from the integration, so the tail bends continuously instead of snapping joint by joint.
 * Look: view normals + depth rendered at 2× resolution, an edge pass keeps creases and silhouettes only.
 */

type BoneData = { head: number[]; tail: number[]; parent?: string | null };
type SceneData = {
  posed: Record<string, BoneData>; rest: Record<string, BoneData>; baseDelta: number[];
  ik: Array<{ bone: string; target: string }>; camera: { matrix: number[]; lens: number; sensor: number };
};

const STEP = 1 / 120;

const edgeShader = {
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `
    uniform sampler2D tNormal; uniform sampler2D tDepth; uniform vec2 texel; uniform float near; uniform float far;
    varying vec2 vUv;
    float viewZ(float d){ return near * far / (far - d * (far - near)); }
    void main(){
      vec4 c = texture2D(tNormal, vUv); float z = viewZ(texture2D(tDepth, vUv).x);
      float depthEdge = 0., normalEdge = 0., coverage = c.a;
      for (int i = 0; i < 8; i++) {
        vec2 o = i == 0 ? vec2(1., 0.) : i == 1 ? vec2(-1., 0.) : i == 2 ? vec2(0., 1.) : i == 3 ? vec2(0., -1.)
               : i == 4 ? vec2(.7, .7) : i == 5 ? vec2(-.7, -.7) : i == 6 ? vec2(.7, -.7) : vec2(-.7, .7);
        vec2 uv = vUv + o * texel;
        vec4 cn = texture2D(tNormal, uv); float zn = viewZ(texture2D(tDepth, uv).x);
        coverage = max(coverage, cn.a);
        if (c.a > .5 && cn.a > .5) {
          depthEdge = max(depthEdge, abs(zn - z) / z);
          normalEdge = max(normalEdge, 1. - dot(c.xyz * 2. - 1., cn.xyz * 2. - 1.));
        } else if (c.a > .5 || cn.a > .5) depthEdge = 1.;
      }
      float edge = max(smoothstep(.012, .03, depthEdge), smoothstep(.12, .3, normalEdge)) * coverage;
      gl_FragColor = vec4(mix(vec3(1.), vec3(.067), edge), max(edge, c.a));
    }`,
};

export default function AstroTail({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false, frame = 0;
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, .05, 60);
    const normalMaterial = new THREE.MeshNormalMaterial();
    scene.overrideMaterial = normalMaterial;
    const target = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1) });
    const edgeMaterial = new THREE.ShaderMaterial({
      ...edgeShader, transparent: true,
      uniforms: { tNormal: { value: target.texture }, tDepth: { value: target.depthTexture }, texel: { value: new THREE.Vector2() }, near: { value: camera.near }, far: { value: camera.far } },
    });
    const quadScene = new THREE.Scene(); quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), edgeMaterial));
    const quadCamera = new THREE.Camera();
    let hfov = 40;

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      // Supersample: lines are drawn at ~2 device px then scaled down, which smooths them.
      const ratio = Math.min(3, (window.devicePixelRatio || 1) * 2);
      renderer.setPixelRatio(ratio); renderer.setSize(w, h);
      target.setSize(Math.round(w * ratio), Math.round(h * ratio));
      edgeMaterial.uniforms.texel.value.set(1 / (w * ratio), 1 / (h * ratio));
      camera.aspect = w / h;
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hfov) / 2) / Math.min(camera.aspect, 16 / 9)));
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);

    // Tail state
    let segments: Array<{ group: THREE.Group; length: number }> = [];
    let P: THREE.Vector3[] = [], prevP: THREE.Vector3[] = [], shape: THREE.Vector3[] = [];
    let follow: number[] = [];
    let reach = 1;

    const restDir = new THREE.Vector3(), baseQ = new THREE.Quaternion(), baseDir = new THREE.Vector3();
    const camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), camFwd = new THREE.Vector3();
    const tip = new THREE.Vector3(), aim = new THREE.Vector3(), goal = new THREE.Vector3();
    const pointer = { x: 0, y: 0, last: -1e9, inside: false };
    let pointerWeight = 0;

    const setup = (gltf: { scene: THREE.Group }, data: SceneData) => {
      const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
      const meshes = new Map<string, THREE.Object3D>();
      gltf.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.set(o.name, o); });
      const body = meshes.get('seg_STATIC'); if (body) scene.add(body);

      const controllers = new Set(data.ik.map(c => c.target).filter(Boolean));
      const order: string[] = [];
      let name: string | undefined = 'Bone.002';
      while (name) {
        order.push(name);
        const parent: string = name;
        name = Object.keys(data.rest).find(k => data.rest[k].parent === parent && !controllers.has(k));
      }
      P = [...order.map(n => v(data.posed[n].head)), v(data.posed[order[order.length - 1]].tail)];
      shape = P.map(p => p.clone()); prevP = P.map(p => p.clone());
      segments = order.map((n, i) => {
        const group = new THREE.Group();
        const mesh = meshes.get('seg_' + n.replace('.', '_'));
        if (mesh) { mesh.position.sub(v(data.rest[n].head)); group.add(mesh); }
        scene.add(group);
        return { group, length: P[i].distanceTo(P[i + 1]) };
      });
      reach = segments.reduce((sum, s) => sum + s.length, 0);
      // How freely each joint follows the tip: the root stays in its socket, the tip is free.
      follow = P.map((_, i) => Math.pow(i / (P.length - 1), 1.6));
      restDir.subVectors(v(data.rest['Bone.002'].tail), v(data.rest['Bone.002'].head)).normalize();
      baseQ.fromArray(data.baseDelta);
      baseDir.subVectors(v(data.posed['Bone.001'].tail), v(data.posed['Bone.001'].head)).normalize();
      tip.copy(P[P.length - 1]); aim.copy(tip); goal.copy(tip);

      const m = new THREE.Matrix4().fromArray(data.camera.matrix);
      m.decompose(camera.position, camera.quaternion, new THREE.Vector3());
      hfov = THREE.MathUtils.radToDeg(2 * Math.atan(data.camera.sensor / 2 / data.camera.lens));
      camera.updateMatrixWorld();
      camRight.setFromMatrixColumn(camera.matrixWorld, 0);
      camUp.setFromMatrixColumn(camera.matrixWorld, 1);
      camera.getWorldDirection(camFwd);
      observer.observe(host); resize();
    };

    const tmp = new THREE.Vector3(), d = new THREE.Vector3(), mid = new THREE.Vector3();
    const simulate = (t: number) => {
      const n = P.length - 1, rest = shape[n];
      // Idle: the tip sways side to side; with a pointer it reaches for the cursor.
      tmp.copy(rest).addScaledVector(camRight, Math.sin(t * 1.15) * reach * .22).addScaledVector(camUp, Math.sin(t * .63 + 1) * reach * .07);
      goal.lerpVectors(tmp, aim, pointerWeight);
      // The tip roams only around its own resting place, so it follows the cursor without crossing the body.
      d.subVectors(goal, rest);
      if (d.length() > reach * .32) goal.copy(rest).addScaledVector(d.normalize(), reach * .32);
      tip.lerp(goal, .06);
      d.subVectors(tip, rest);
      for (let i = 1; i <= n; i++) {
        // Verlet step with damping, then a spring toward the target shape.
        tmp.subVectors(P[i], prevP[i]).multiplyScalar(.9);
        prevP[i].copy(P[i]); P[i].add(tmp);
        mid.copy(shape[i]).addScaledVector(d, follow[i]);
        P[i].lerp(mid, .035 + .05 * follow[i]);
      }
      for (let iter = 0; iter < 3; iter++) {
        // Curvature smoothing keeps the spine from kinking between neighbours.
        for (let i = 1; i < n; i++) { mid.addVectors(P[i - 1], P[i + 1]).multiplyScalar(.5); P[i].lerp(mid, .18); }
        // Lengths restored from the root outward, with the first link leaving the mount along its socket.
        for (let i = 0; i < n; i++) {
          d.subVectors(P[i + 1], P[i]).normalize();
          if (i === 0) d.lerp(baseDir, .6).normalize();
          P[i + 1].copy(P[i]).addScaledVector(d, segments[i].length);
        }
      }
    };
    // Parallel transport from the mount's frame keeps segment twist continuous.
    const q = new THREE.Quaternion(), stepQ = new THREE.Quaternion(), prevDir = new THREE.Vector3(), dir = new THREE.Vector3();
    const pose = () => {
      q.copy(baseQ); prevDir.copy(restDir).applyQuaternion(baseQ);
      segments.forEach((seg, i) => {
        dir.subVectors(P[i + 1], P[i]).normalize();
        stepQ.setFromUnitVectors(prevDir, dir); q.premultiply(stepQ);
        seg.group.position.copy(P[i]); seg.group.quaternion.copy(q);
        prevDir.copy(dir);
      });
    };

    const ray = new THREE.Raycaster(), plane = new THREE.Plane(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
    let last = performance.now(), acc = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!segments.length) return;
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      const active = pointer.inside && now - pointer.last < 3000;
      pointerWeight += ((active ? 1 : 0) - pointerWeight) * (1 - Math.exp(-dt * 2.5));
      if (pointer.inside) {
        plane.setFromNormalAndCoplanarPoint(camFwd, shape[shape.length - 1]);
        ray.setFromCamera(ndc.set(pointer.x, pointer.y), camera);
        if (ray.ray.intersectPlane(plane, hit)) aim.copy(hit);
      }
      for (acc += dt; acc >= STEP; acc -= STEP) simulate(now / 1000 - acc);
      pose();
      renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.clear(); renderer.render(quadScene, quadCamera);
    };

    const move = (event: PointerEvent) => {
      const r = host.getBoundingClientRect();
      pointer.x = (event.clientX - r.left) / r.width * 2 - 1; pointer.y = -((event.clientY - r.top) / r.height * 2 - 1);
      pointer.last = performance.now(); pointer.inside = true;
    };
    const leave = () => { pointer.inside = false; };
    host.addEventListener('pointermove', move); host.addEventListener('pointerdown', move); host.addEventListener('pointerleave', leave);

    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    Promise.all([loader.loadAsync('/lab/astro-tail.glb'), fetch('/lab/astro-tail.json').then(r => r.json() as Promise<SceneData>)])
      .then(([gltf, data]) => { if (!disposed) { setup(gltf, data); frame = requestAnimationFrame(tick); } })
      .catch(error => console.error('Astronaut scene failed to load', error));

    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      host.removeEventListener('pointermove', move); host.removeEventListener('pointerdown', move); host.removeEventListener('pointerleave', leave);
      scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
      target.dispose(); edgeMaterial.dispose(); normalMaterial.dispose(); draco.dispose(); renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className={className} />;
}
