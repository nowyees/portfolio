import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/*
 * Graduation piece: the astronaut held at frame 135 of the Blender scene, its robotic tail alive.
 * Geometry (public/lab/astro-tail.glb): one static mesh for the body + fixed tail mount, and one rigid
 *   mesh per tail bone in rest pose (the skinned hoses are split onto their dominant bones in Blender). Normals are split at 38° in Blender so only real creases draw.
 * Motion: the tail rests in its frame-135 pose; a click swings it through the tail animation authored in
 *   Blender (public/lab/astro-tail-anim.json, frames 99-135) and back. Positions are chained from the socket.
 * Framing: the scene camera at frame 135, rolled so the astronaut stands upright and fitted to the view,
 *   with room for everything the tail sweeps through in the clip.
 * Look: view normals + depth rendered at 2× resolution, an edge pass keeps creases and silhouettes only.
 */

type BoneData = { head: number[]; tail: number[]; parent?: string | null };
type SceneData = {
  posed: Record<string, BoneData>; rest: Record<string, BoneData>; baseDelta: number[];
  ik: Array<{ bone: string; target: string }>; camera: { matrix: number[]; lens: number; sensor: number };
  body: Record<string, number[]>;
};
// Tail animation baked from Blender: per frame, each chain bone's rest-to-posed rotation (x, y, z, w).
type TailClip = { fps: number; frames: number[]; bones: string[]; hold: number; quats: number[][] };


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

    // Tail: held in its frame-135 pose. A click swings it through the tail animation authored in Blender —
    // from frame 135 back to the start of the clip (frame 99) and forward again — on a sine of time, so it eases
    // out of rest, turns softly and settles exactly where it started. Frames after ~140 are not used: there the
    // authored tail passes behind the body for this camera. Rotations are interpolated per joint relative to the
    // previous segment and positions are chained from the socket, so the tail always moves as one piece.
    let segments: Array<{ group: THREE.Group; length: number }> = [];
    let P: THREE.Vector3[] = [], F: THREE.Quaternion[] = [];
    // Per frame, segment 0's world rotation followed by each segment's rotation relative to the one before it.
    let clip: THREE.Quaternion[][] = [], hold: THREE.Quaternion[] = [];
    let fps = 25, holdFrame = 0;
    const SWING_TO = 0; // index of frame 99, the far end of the swing
    const restDir = new THREE.Vector3();
    let playing = -1; // start time of the current play, or -1 when resting
    const SWING_PACE = 1.1; // slower than authored by this factor, since the sine eases both ends

    const qb = new THREE.Quaternion(), step = new THREE.Vector3();
    // Pose the chain from relative rotations: frames and positions follow from the socket outward.
    const chain = (rotations: (i: number, out: THREE.Quaternion) => THREE.Quaternion) => {
      for (let i = 0; i < segments.length; i++) {
        rotations(i, qb);
        if (i === 0) F[0].copy(qb); else F[i].multiplyQuaternions(F[i - 1], qb);
        step.copy(restDir).applyQuaternion(F[i]);
        P[i + 1].copy(P[i]).addScaledVector(step, segments[i].length);
      }
    };
    const clipAt = (frameIndex: number, i: number, out: THREE.Quaternion) => {
      const f = THREE.MathUtils.clamp(frameIndex, 0, clip.length - 1), k = Math.floor(f);
      return out.slerpQuaternions(clip[k][i], clip[Math.min(k + 1, clip.length - 1)][i], f - k);
    };

    const setup = (gltf: { scene: THREE.Group }, data: SceneData, anim: TailClip) => {
      const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
      const meshes = new Map<string, THREE.Object3D>();
      gltf.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.set(o.name, o); });
      const body = meshes.get('seg_STATIC'); if (body) scene.add(body);

      const order = anim.bones;
      P = [...order.map(n => v(data.posed[n].head)), v(data.posed[order[order.length - 1]].tail)];
      segments = order.map((n, i) => {
        const group = new THREE.Group();
        const mesh = meshes.get('seg_' + n.replace('.', '_'));
        if (mesh) { mesh.position.sub(v(data.rest[n].head)); group.add(mesh); }
        scene.add(group);
        return { group, length: P[i].distanceTo(P[i + 1]) };
      });
      F = segments.map(() => new THREE.Quaternion());
      restDir.subVectors(v(data.rest[order[0]].tail), v(data.rest[order[0]].head)).normalize();
      fps = anim.fps;
      clip = anim.quats.map(row => {
        const world = order.map((_, i) => new THREE.Quaternion(row[i * 4], row[i * 4 + 1], row[i * 4 + 2], row[i * 4 + 3]));
        return world.map((q, i) => i === 0 ? q : world[i - 1].clone().invert().multiply(q));
      });
      holdFrame = anim.frames.indexOf(anim.hold);
      hold = clip[holdFrame].map(q => q.clone());

      // Everything the tail reaches during the swing, so framing leaves room for the whole motion.
      const reachPoints: THREE.Vector3[] = [];
      clip.slice(SWING_TO, holdFrame + 1).forEach(row => { chain((i, out) => out.copy(row[i])); P.forEach(p => reachPoints.push(p.clone())); });
      chain((i, out) => out.copy(hold[i]));

      const b = (k: string) => v(data.body[k]);
      const m = new THREE.Matrix4().fromArray(data.camera.matrix);
      m.decompose(camera.position, camera.quaternion, new THREE.Vector3());
      camera.updateMatrixWorld();
      // Roll the camera about its view axis until the body's feet-to-head line points straight up.
      const toView = (p: THREE.Vector3) => p.clone().applyMatrix4(camera.matrixWorldInverse);
      const feet = b('LeftFoot').add(b('RightFoot')).multiplyScalar(.5);
      const axis = toView(b('HeadTop_End')).sub(toView(feet));
      camera.rotateZ(Math.atan2(axis.y, axis.x) - Math.PI / 2);
      camera.updateMatrixWorld();
      // Centre the astronaut and everything the tail sweeps through, then remember the view angle they need.
      const pts = [...Object.values(data.body).map(v), ...reachPoints].map(toView);
      const box = new THREE.Box3().setFromPoints(pts);
      const shiftX = (box.min.x + box.max.x) / 2, shiftY = (box.min.y + box.max.y) / 2;
      camera.translateX(shiftX); camera.translateY(shiftY); camera.updateMatrixWorld();
      fitX = 0; fitY = 0;
      pts.forEach(p => {
        const depth = -(p.z);
        fitX = Math.max(fitX, (Math.abs(p.x - shiftX) + .08) / depth);
        fitY = Math.max(fitY, (Math.abs(p.y - shiftY) + .12) / depth);
      });
      observer.observe(host); resize();
    };

    const simulate = (now: number) => {
      if (playing < 0) { chain((i, out) => out.copy(hold[i])); return; }
      const span = SWING_TO - holdFrame, duration = 2 * Math.abs(span) / fps * SWING_PACE, u = (now - playing) / duration;
      if (u >= 1) { playing = -1; chain((i, out) => out.copy(hold[i])); return; }
      const f = holdFrame + span * Math.sin(Math.PI * u);
      chain((i, out) => clipAt(f, i, out));
    };
    const pose = () => {
      segments.forEach((s, i) => { s.group.position.copy(P[i]); s.group.quaternion.copy(F[i]); });
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!segments.length) return;
      simulate(now / 1000);
      pose();
      renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.clear(); renderer.render(quadScene, quadCamera);
    };

    // A click sets the tail moving; clicks while it is already moving are ignored so the motion plays through.
    const click = () => { if (playing < 0 && clip.length) playing = performance.now() / 1000; };
    host.addEventListener('pointerdown', click);

    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    Promise.all([
      loader.loadAsync('/lab/astro-tail.glb'),
      fetch('/lab/astro-tail.json').then(r => r.json() as Promise<SceneData>),
      fetch('/lab/astro-tail-anim.json').then(r => r.json() as Promise<TailClip>),
    ]).then(([gltf, data, anim]) => { if (!disposed) { setup(gltf, data, anim); frame = requestAnimationFrame(tick); } })
      .catch(error => console.error('Astronaut scene failed to load', error));

    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      host.removeEventListener('pointerdown', click);
      scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
      target.dispose(); edgeMaterial.dispose(); normalMaterial.dispose(); draco.dispose(); renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className={className} />;
}
