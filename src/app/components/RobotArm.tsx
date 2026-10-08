import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/*
 * The graduation-show robot arm, drawn as hairlines and steered by the pointer.
 * Geometry: one rigid segment per bone, exported from Blender in rest pose (public/lab/robot-arm.glb).
 * Motion: soft multi-target FABRIK over the bone chain, mirroring the Blender rig's three IK controllers.
 * Look: normals + depth are rendered off-screen, then an edge pass draws only creases and silhouettes.
 */

type BoneInfo = { name: string; parent: string | null; head: number[]; tail: number[] };
type Rig = { bones: BoneInfo[]; ik: Array<{ bone: string; target: string; chain: number }> };

const MAX_BEND = .3; // radians a joint may bend relative to the previous segment
const INK = new THREE.Color('#111111');

const edgeShader = {
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `
    uniform sampler2D tNormal; uniform sampler2D tDepth; uniform vec2 texel; uniform float depthRange; uniform vec3 ink;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tNormal, vUv); float d = texture2D(tDepth, vUv).x;
      float depthEdge = 0., normalEdge = 0.; float coverage = c.a;
      for (int i = 0; i < 4; i++) {
        vec2 o = i == 0 ? vec2(texel.x, 0.) : i == 1 ? vec2(-texel.x, 0.) : i == 2 ? vec2(0., texel.y) : vec2(0., -texel.y);
        vec4 cn = texture2D(tNormal, vUv + o); float dn = texture2D(tDepth, vUv + o).x;
        coverage = max(coverage, cn.a);
        depthEdge += abs(dn - d) * depthRange;
        if (c.a > .5 && cn.a > .5) normalEdge += 1. - dot(c.xyz * 2. - 1., cn.xyz * 2. - 1.);
      }
      float edge = max(smoothstep(.03, .06, depthEdge), smoothstep(.85, 1.35, normalEdge));
      edge *= coverage;
      gl_FragColor = vec4(mix(vec3(1.), ink, edge), max(edge, c.a));
    }`,
};

export default function RobotArm({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false, frame = 0;
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 20);
    const normalMaterial = new THREE.MeshNormalMaterial();
    scene.overrideMaterial = normalMaterial;

    const target = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1), type: THREE.UnsignedByteType });
    const edgeMaterial = new THREE.ShaderMaterial({
      ...edgeShader,
      uniforms: { tNormal: { value: target.texture }, tDepth: { value: target.depthTexture }, texel: { value: new THREE.Vector2() }, depthRange: { value: 1 }, ink: { value: INK } },
      transparent: true,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), edgeMaterial);
    const quadScene = new THREE.Scene(); quadScene.add(quad);
    const quadCamera = new THREE.Camera();

    // Rig state, filled once data arrives.
    let chain: Array<{ name: string; length: number; group: THREE.Group }> = [];
    let joints: THREE.Vector3[] = [];
    let ends: number[] = []; // joint indices pulled by the three controllers
    let reach = 1, center = new THREE.Vector3();
    const goals = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const pulls = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const pointer = { x: 0, y: 0, active: false, last: 0 };

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight, dpr = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(dpr); renderer.setSize(w, h);
      target.setSize(w * dpr, h * dpr);
      edgeMaterial.uniforms.texel.value.set(1.15 / (w * dpr), 1.15 / (h * dpr));
      const view = reach * 1.18, aspect = w / h;
      camera.left = -view * aspect / 2; camera.right = view * aspect / 2; camera.top = view / 2; camera.bottom = -view / 2;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);

    const setup = (gltf: { scene: THREE.Group }, rig: Rig) => {
      const byName = new Map(rig.bones.map(b => [b.name, b]));
      const controllers = new Set(rig.ik.map(c => c.target));
      // Walk the main chain from the first moving bone to the tip, skipping controller bones.
      const order: BoneInfo[] = [];
      let current = byName.get('Bone.001');
      while (current) {
        order.push(current);
        const name: string = current.name;
        current = rig.bones.find(b => b.parent === name && !controllers.has(b.name));
      }
      const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
      joints = [...order.map(b => v(b.head)), v(order[order.length - 1].tail)];
      reach = joints[joints.length - 1].distanceTo(joints[0]);
      center.copy(joints[0]).addScaledVector(new THREE.Vector3(0, 1, 0), reach * .46);
      ends = rig.ik.map(c => order.findIndex(b => b.name === c.bone) + 1);

      const meshes = new Map<string, THREE.Object3D>();
      gltf.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.set(o.name, o); });
      const base = meshes.get('seg_BASE'); if (base) scene.add(base);
      chain = order.map((b, i) => {
        const group = new THREE.Group();
        const mesh = meshes.get('seg_' + b.name.replace('.', '_'));
        if (mesh) { mesh.position.sub(joints[i]); group.add(mesh); }
        scene.add(group);
        return { name: b.name, length: joints[i].distanceTo(joints[i + 1]), group };
      });
      ends.forEach((j, k) => { goals[k].copy(joints[j]); pulls[k].copy(joints[j]); });

      // Three-quarter view from above, like the Blender viewport in the reference.
      camera.position.copy(center).add(new THREE.Vector3(1.1, .75, 1.6).normalize().multiplyScalar(5));
      camera.lookAt(center);
      camera.near = .5; camera.far = 10; edgeMaterial.uniforms.depthRange.value = camera.far - camera.near;
      observer.observe(host); resize();
    };

    // Soft multi-target FABRIK with a per-joint bend limit so the spine curls instead of kinking.
    const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), dir = new THREE.Vector3(), prev = new THREE.Vector3();
    const solve = () => {
      const n = chain.length, root = joints[0].clone();
      for (let iter = 0; iter < 12; iter++) {
        joints[n].copy(pulls[2]);
        for (let i = n - 1; i >= 0; i--) {
          const k = ends.indexOf(i);
          if (k >= 0 && k < 2) joints[i].lerp(pulls[k], .35);
          dir.subVectors(joints[i], joints[i + 1]).normalize();
          joints[i].copy(joints[i + 1]).addScaledVector(dir, chain[i].length);
        }
        joints[0].copy(root); prev.copy(up);
        for (let i = 0; i < n; i++) {
          dir.subVectors(joints[i + 1], joints[i]).normalize();
          const angle = prev.angleTo(dir);
          if (angle > MAX_BEND) {
            tmp.crossVectors(prev, dir).normalize();
            if (tmp.lengthSq() > 1e-8) dir.copy(prev).applyAxisAngle(tmp, MAX_BEND);
          }
          joints[i + 1].copy(joints[i]).addScaledVector(dir, chain[i].length);
          prev.copy(dir);
        }
      }
    };
    // Parallel transport keeps each segment's twist continuous along the chain.
    const q = new THREE.Quaternion(), step = new THREE.Quaternion();
    const pose = () => {
      q.identity(); prev.copy(up);
      chain.forEach((seg, i) => {
        dir.subVectors(joints[i + 1], joints[i]).normalize();
        step.setFromUnitVectors(prev, dir); q.premultiply(step);
        seg.group.position.copy(joints[i]); seg.group.quaternion.copy(q);
        prev.copy(dir);
      });
    };

    const ray = new THREE.Raycaster(), plane = new THREE.Plane(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
    const camDir = new THREE.Vector3(), away = new THREE.Vector3();
    let last = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (chain.length) {
        const t = now / 1000;
        // Tip: follow the pointer on the plane through the arm, or wander when idle.
        const idle = !pointer.active || now - pointer.last > 2500;
        if (idle) {
          goals[2].set(Math.sin(t * .41) * .55, .35 + Math.sin(t * .29) * .3, Math.cos(t * .33) * .45).multiplyScalar(reach).add(center);
        } else {
          camera.getWorldDirection(camDir); plane.setFromNormalAndCoplanarPoint(camDir, center);
          ndc.set(pointer.x, pointer.y); ray.setFromCamera(ndc, camera);
          if (ray.ray.intersectPlane(plane, hit)) goals[2].copy(hit);
        }
        tmp.subVectors(goals[2], joints[0]);
        if (tmp.length() > reach * .95) goals[2].copy(joints[0]).addScaledVector(tmp.normalize(), reach * .95);
        // Mid controllers trail behind the tip with their own slow drift, which gives the S-curves.
        // Lower controller leans away from the tip and the middle one rises above it, so the spine draws an S like the rig in Blender.
        away.subVectors(center, goals[2]).setY(0);
        goals[0].copy(joints[0]).addScaledVector(up, reach * .3).addScaledVector(away, .32)
          .add(tmp.set(Math.sin(t * .17), 0, Math.cos(t * .21)).multiplyScalar(reach * .05));
        goals[1].lerpVectors(center, goals[2], .5).addScaledVector(up, reach * .16)
          .add(tmp.set(Math.sin(t * .23), Math.sin(t * .37) * .5, Math.cos(t * .19)).multiplyScalar(reach * .09));
        const ease = 1 - Math.exp(-dt * 3.2);
        pulls.forEach((p, k) => p.lerp(goals[k], k === 2 ? ease : ease * .7));
        solve(); pose();
        renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
        renderer.setRenderTarget(null); renderer.clear(); renderer.render(quadScene, quadCamera);
      }
    };

    const move = (event: PointerEvent) => {
      const r = host.getBoundingClientRect();
      pointer.x = (event.clientX - r.left) / r.width * 2 - 1;
      pointer.y = -((event.clientY - r.top) / r.height * 2 - 1);
      pointer.active = true; pointer.last = performance.now();
    };
    const leave = () => { pointer.active = false; };
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerdown', move);
    host.addEventListener('pointerleave', leave);

    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    Promise.all([loader.loadAsync('/lab/robot-arm.glb'), fetch('/lab/robot-arm.json').then(r => r.json() as Promise<Rig>)])
      .then(([gltf, rig]) => { if (!disposed) { setup(gltf, rig); frame = requestAnimationFrame(tick); } })
      .catch(error => console.error('Robot arm failed to load', error));

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
