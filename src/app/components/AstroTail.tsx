import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/*
 * Graduation piece: the astronaut held at frame 135 of the Blender scene, its robotic tail alive.
 * Geometry (public/lab/astro-tail.glb): one static mesh for the body + fixed tail mount, and one rigid
 *   mesh per tail bone in rest pose (the skinned hoses are split onto their dominant bones in Blender). Normals are split at 38° in Blender so only real creases draw.
 * Motion: the tail plays its swing from the graduation film (Blender frames 1-77) forward and back; the
 *   cursor leans the swing toward its side and a click plays it faster for a moment.
 * Framing: squarely behind the astronaut (as in the film) at the scene camera's distance, upright, fitted to the view,
 *   with room for everything the tail sweeps through at its widest.
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

    // Tail: plays the swing from the graduation film — frames 1–77 of the Blender tail animation — forward and
    // back on a loop, so there is never a jump between its end and its start. The cursor leans the whole swing
    // toward its side; a click plays it faster for a moment. Rotations are interpolated per joint relative to
    // the previous segment and positions are chained from the socket, so the tail always moves as one piece.
    let segments: Array<{ group: THREE.Group; length: number }> = [];
    let P: THREE.Vector3[] = [], F: THREE.Quaternion[] = [];
    let clip: THREE.Quaternion[][] = [];  // per frame: segment 0's world rotation, then each relative to the previous
    const restDir = new THREE.Vector3();
    const viewAxis = new THREE.Vector3(); // the camera's line of sight: turning about it leans the tail across the screen

    // film frames, and the film's frame rate (it was exported at 30 fps)
    const LOOP = { first: 1, last: 77, fps: 30 };
    const KICK = { speed: 1.2, decay: 1.5 };           // a click adds this much playback speed, fading over `decay` s
    const AIM = { range: .45, rate: 4 };               // how far (radians) the cursor can lean the tail, and how fast
    const pointer = { x: 0, y: 0, inside: false };
    let time = 0, kick = 0, kickTarget = 0, lastTime = -1;
    let aim = 0, aimEase = 0;

    const qb = new THREE.Quaternion(), qv = new THREE.Quaternion();
    const step = new THREE.Vector3(), socketScreen = new THREE.Vector3();
    // Pose the chain from relative rotations, leaned about the view axis; positions follow from the socket.
    const chain = (rotations: (i: number, out: THREE.Quaternion) => THREE.Quaternion, lean: number) => {
      qv.setFromAxisAngle(viewAxis, lean);
      for (let i = 0; i < segments.length; i++) {
        rotations(i, qb);
        if (i === 0) F[0].multiplyQuaternions(qv, qb); else F[i].multiplyQuaternions(F[i - 1], qb);
        step.copy(restDir).applyQuaternion(F[i]);
        P[i + 1].copy(P[i]).addScaledVector(step, segments[i].length);
      }
    };
    const frameAt = (f: number, i: number, out: THREE.Quaternion) => {
      const k = Math.floor(f), next = Math.min(k + 1, clip.length - 1);
      return out.slerpQuaternions(clip[k][i], clip[next][i], f - k);
    };
    // Loop time (in frames) to a pose. The film's swing never returns to its first pose, so instead of jumping
    // back the clip plays forward and then in reverse, easing to a stop at each end like a pendulum turning.
    const loopPose = (t: number, i: number, out: THREE.Quaternion) => {
      const span = clip.length - 1, u = t / (2 * span * PACE);
      return frameAt(span * (1 - Math.cos(Math.PI * 2 * u)) / 2, i, out);
    };
    const PACE = 1.25; // eased turns need a little more time than the film's straight run

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
      // Clip frames are indexed from the film's frame 1.
      const firstFrame = anim.frames[0];
      clip = anim.quats.slice(LOOP.first - firstFrame, LOOP.last - firstFrame + 1).map(row => {
        const world = order.map((_, i) => new THREE.Quaternion(row[i * 4], row[i * 4 + 1], row[i * 4 + 2], row[i * 4 + 3]));
        return world.map((q, i) => i === 0 ? q : world[i - 1].clone().invert().multiply(q));
      });

      const b = (k: string) => v(data.body[k]);
      const upAxis = new THREE.Vector3().subVectors(b('HeadTop_End'), b('LeftFoot').add(b('RightFoot')).multiplyScalar(.5)).normalize();
      // Look at the astronaut squarely from behind, as in the film, at the Blender scene camera's distance.
      const m = new THREE.Matrix4().fromArray(data.camera.matrix);
      const sceneCamera = new THREE.Vector3().setFromMatrixPosition(m);
      const centre = b('Hips').add(b('Spine2')).multiplyScalar(.5);
      const back = new THREE.Vector3().subVectors(P[0], centre);
      back.addScaledVector(upAxis, -back.dot(upAxis)).normalize();
      camera.position.copy(centre).addScaledVector(back, sceneCamera.distanceTo(centre));
      camera.up.copy(upAxis); camera.lookAt(centre);
      camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      camera.getWorldDirection(viewAxis);
      const toView = (p: THREE.Vector3) => p.clone().applyMatrix4(camera.matrixWorldInverse);

      // Everything the tail sweeps through over the loop, leaned either way, so framing leaves room for it.
      const reachPoints: THREE.Vector3[] = [];
      for (const lean of [-AIM.range, 0, AIM.range]) {
        clip.forEach(row => { chain((i, out) => out.copy(row[i]), lean); P.forEach(p => reachPoints.push(p.clone())); });
      }
      chain((i, out) => loopPose(0, i, out), 0);

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
      // Never step backwards or by more than a frame's worth, whatever the clock does (tab switches, etc.).
      const dt = lastTime < 0 ? 0 : THREE.MathUtils.clamp(now - lastTime, 0, .05); lastTime = now;
      // A click's speed-up eases in over a moment rather than jumping, then fades.
      if (kickTarget > 0) { kick += (kickTarget - kick) * (1 - Math.exp(-dt * 4)); if (kickTarget - kick < .02) kickTarget = 0; }
      else kick *= Math.exp(-dt / KICK.decay);
      time += dt * LOOP.fps * (1 + KICK.speed * kick);
      // The cursor's side of the socket leans the swing toward it (clockwise on screen is positive).
      let want = 0;
      if (pointer.inside) {
        socketScreen.copy(P[0]).project(camera);
        const side = THREE.MathUtils.clamp((pointer.x - socketScreen.x) * camera.aspect, -1, 1);
        want = -side * AIM.range;
      }
      // Two easing stages: the lean starts and stops softly, with no jolt.
      const k = 1 - Math.exp(-dt * AIM.rate);
      aimEase += (want - aimEase) * k; aim += (aimEase - aim) * k;
      chain((i, out) => loopPose(time, i, out), aim);
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

    // A click speeds the swing up for a moment; repeated clicks stack a little.
    const click = () => { kickTarget = Math.min(1.6, kick + 1); };
    const move = (event: PointerEvent) => {
      const r = host.getBoundingClientRect();
      pointer.x = (event.clientX - r.left) / r.width * 2 - 1; pointer.y = -((event.clientY - r.top) / r.height * 2 - 1);
      pointer.inside = true;
    };
    const leave = () => { pointer.inside = false; };
    host.addEventListener('pointerdown', click); host.addEventListener('pointermove', move); host.addEventListener('pointerleave', leave);

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
      host.removeEventListener('pointerdown', click); host.removeEventListener('pointermove', move); host.removeEventListener('pointerleave', leave);
      scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
      target.dispose(); edgeMaterial.dispose(); normalMaterial.dispose(); draco.dispose(); renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className={className} />;
}
