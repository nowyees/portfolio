import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/*
 * Graduation piece: the astronaut held at frame 135 of the Blender scene, its robotic tail alive.
 * Geometry (public/lab/astro-tail.glb): one static mesh for the body + fixed tail mount, and one rigid
 *   mesh per tail bone in rest pose (the skinned hoses are split onto their dominant bones in Blender). Normals are split at 38° in Blender so only real creases draw.
 * Motion: no velocities are integrated, so nothing can spring or bounce. The tip's offset from its rest
 *   place is eased through two low-pass stages; each joint aims at the frame-135 shape shifted by that
 *   offset (more toward the tip), positions are smoothed over time and lengths restored root-to-tip.
 * Framing: the scene camera at frame 135, rolled so the astronaut stands upright and fitted to the view.
 * Look: view normals + depth rendered at 2× resolution, an edge pass keeps creases and silhouettes only.
 */

type BoneData = { head: number[]; tail: number[]; parent?: string | null };
type SceneData = {
  posed: Record<string, BoneData>; rest: Record<string, BoneData>; baseDelta: number[];
  ik: Array<{ bone: string; target: string }>; camera: { matrix: number[]; lens: number; sensor: number };
  body: Record<string, number[]>;
};


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
    let fitX = .3, fitY = .3; // half-extents of the subject as tangents of the view angle

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      // Supersample: lines are drawn at ~2 device px then scaled down, which smooths them.
      const ratio = Math.min(3, (window.devicePixelRatio || 1) * 2);
      renderer.setPixelRatio(ratio); renderer.setSize(w, h);
      target.setSize(Math.round(w * ratio), Math.round(h * ratio));
      edgeMaterial.uniforms.texel.value.set(1 / (w * ratio), 1 / (h * ratio));
      camera.aspect = w / h;
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(fitY, fitX / camera.aspect) / .8));
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);

    // Tail state
    let segments: Array<{ group: THREE.Group; length: number }> = [];
    let P: THREE.Vector3[] = [], shape: THREE.Vector3[] = [], want: THREE.Vector3[] = [];
    let follow: number[] = [];
    let reach = 1;

    const restDir = new THREE.Vector3(), baseQ = new THREE.Quaternion(), baseDir = new THREE.Vector3();
    const camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), camFwd = new THREE.Vector3();
    const aim = new THREE.Vector3(), goal = new THREE.Vector3();
    const ease1 = new THREE.Vector3(), ease2 = new THREE.Vector3(); // two-stage eased tip offset
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
      shape = P.map(p => p.clone()); want = P.map(p => p.clone());
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
      aim.copy(shape[shape.length - 1]);

      const m = new THREE.Matrix4().fromArray(data.camera.matrix);
      m.decompose(camera.position, camera.quaternion, new THREE.Vector3());
      camera.updateMatrixWorld();
      // Roll the camera about its view axis until the body's feet→head line points straight up.
      const toView = (p: THREE.Vector3) => p.clone().applyMatrix4(camera.matrixWorldInverse);
      const feet = v(data.body.LeftFoot).add(v(data.body.RightFoot)).multiplyScalar(.5);
      const axis = toView(v(data.body.HeadTop_End)).sub(toView(feet));
      camera.rotateZ(Math.atan2(axis.y, axis.x) - Math.PI / 2);
      camera.updateMatrixWorld();
      // Centre the astronaut and the tail's reach, then remember how much view angle they need.
      const sway = reach * .32;
      const pts = [...Object.values(data.body).map(v), ...shape].map(toView);
      const box = new THREE.Box3().setFromPoints(pts);
      const shiftX = (box.min.x + box.max.x) / 2, shiftY = (box.min.y + box.max.y) / 2;
      camera.translateX(shiftX); camera.translateY(shiftY); camera.updateMatrixWorld();
      fitX = 0; fitY = 0;
      pts.forEach(p => {
        const depth = -(p.z), x = Math.abs(p.x - shiftX) + sway * .5, y = Math.abs(p.y - shiftY) + sway * .5;
        fitX = Math.max(fitX, x / depth); fitY = Math.max(fitY, y / depth);
      });
      camRight.setFromMatrixColumn(camera.matrixWorld, 0);
      camUp.setFromMatrixColumn(camera.matrixWorld, 1);
      camera.getWorldDirection(camFwd);
      observer.observe(host); resize();
    };

    const tmp = new THREE.Vector3(), d = new THREE.Vector3(), mid = new THREE.Vector3(), outward = new THREE.Vector3();
    const restore = () => {
      // Lengths restored from the root outward; the first link leaves the mount along its socket.
      for (let i = 0; i < segments.length; i++) {
        d.subVectors(P[i + 1], P[i]).normalize();
        if (i === 0) d.lerp(baseDir, .6).normalize();
        P[i + 1].copy(P[i]).addScaledVector(d, segments[i].length);
      }
    };
    const simulate = (t: number, dt: number) => {
      const n = P.length - 1, rest = shape[n];
      // Idle: the tip sways side to side on screen; with a pointer it leans toward the cursor.
      tmp.copy(rest).addScaledVector(camRight, Math.sin(t * .9) * reach * .2).addScaledVector(camUp, Math.sin(t * .55 + 1) * reach * .05);
      goal.lerpVectors(tmp, aim, pointerWeight);
      // The tip roams only around its own resting place, so it never crosses the body.
      d.subVectors(goal, rest);
      // Pulling the tip back toward the root would only bunch the spine up, so that component is mostly dropped.
      outward.subVectors(rest, P[0]).normalize();
      const back = d.dot(outward);
      if (back < 0) d.addScaledVector(outward, -back * .85);
      if (d.length() > reach * .32) d.setLength(reach * .32);
      // Two cascaded low-pass stages: smooth start, smooth stop, no overshoot.
      const k = 1 - Math.exp(-dt * 4.5);
      ease1.lerp(d, k); ease2.lerp(ease1, k);
      for (let i = 1; i <= n; i++) want[i].copy(shape[i]).addScaledVector(ease2, follow[i]);
      // Joints ease toward their aim (tip slightly slower than the root), giving a soft travelling lag.
      for (let i = 1; i <= n; i++) P[i].lerp(want[i], 1 - Math.exp(-dt * (14 - 6 * follow[i])));
      restore();
      for (let i = 1; i < n; i++) { mid.addVectors(P[i - 1], P[i + 1]).multiplyScalar(.5); P[i].lerp(mid, .12); }
      restore();
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
    let last = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!segments.length) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      const active = pointer.inside && now - pointer.last < 3000;
      pointerWeight += ((active ? 1 : 0) - pointerWeight) * (1 - Math.exp(-dt * 2.5));
      if (pointer.inside) {
        plane.setFromNormalAndCoplanarPoint(camFwd, shape[shape.length - 1]);
        ray.setFromCamera(ndc.set(pointer.x, pointer.y), camera);
        if (ray.ray.intersectPlane(plane, hit)) aim.copy(hit);
      }
      simulate(now / 1000, dt);
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
