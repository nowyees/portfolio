import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/*
 * Graduation piece: the astronaut held at frame 135 of the Blender scene, its robotic tail alive.
 * Geometry (public/lab/astro-tail.glb): one static mesh for the body + fixed tail mount, and one rigid
 *   mesh per tail bone in rest pose (the skinned hoses are split onto their dominant bones in Blender). Normals are split at 38° in Blender so only real creases draw.
 * Motion: around its authored frame-135 pose the tail wags side to side as a travelling wave (socket first,
 *   tip last and widest); a click whips it harder and faster before it settles. Joints bend only across their
 *   own segment, so it never twists; positions are chained from the socket.
 * Framing: the scene camera at frame 135, rolled so the astronaut stands upright and fitted to the view,
 *   with room for everything the tail sweeps through at its widest.
 * Look: view normals + depth rendered at 2× resolution, an edge pass keeps creases and silhouettes only.
 */

type BoneData = { head: number[]; tail: number[]; parent?: string | null };
type SceneData = {
  posed: Record<string, BoneData>; rest: Record<string, BoneData>; baseDelta: number[];
  ik: Array<{ bone: string; target: string }>; camera: { matrix: number[]; lens: number; sensor: number };
  body: Record<string, number[]>;
};
// Tail pose baked from Blender: per frame, each chain bone's rest-to-posed rotation (x, y, z, w); `hold` is used.
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

    // Tail: always alive. Seen from behind the astronaut, a wag is the whole tail swinging left and right about
    // the body's vertical axis: the socket leads with the big swing and every vertebra adds a little more, a beat
    // later, so the tip follows through like a real tail. A slower second wave and a drifting amplitude keep it
    // from looking mechanical. A click whips it wider and faster, then it settles back to its easy wag.
    // Rotations about one shared axis simply add up along the chain, so the authored shape is kept and nothing
    // twists; positions are chained from the socket, so it never comes apart.
    let segments: Array<{ group: THREE.Group; length: number }> = [];
    let P: THREE.Vector3[] = [], F: THREE.Quaternion[] = [];
    let hold: THREE.Quaternion[] = [];   // segment 0's world rotation, then each segment relative to the previous
    let holdWorld: THREE.Quaternion[] = [];
    let weight: number[] = [];           // per joint share of the follow-through, growing toward the tip
    const upAxis = new THREE.Vector3();  // the body's vertical, which the tail swings around
    const restDir = new THREE.Vector3();

    // socket swing (radians), follow-through per joint (radians), speed (radians/second), phase lag per joint,
    // and the centre of the swing (radians, toward the camera so the tail stays in front of the body)
    const WAG = { root: .4, follow: .012, speed: 2.2, lag: .06, centre: .6 };
    const KICK = { gain: .8, speed: 2.2, decay: 1.6 };    // a click widens the wag by `gain` and speeds it up
    let phase = 0, slowPhase = 0, kick = 0, kickTarget = 0, lastTime = -1;

    const qb = new THREE.Quaternion(), qw = new THREE.Quaternion(), step = new THREE.Vector3();
    // Pose the chain from relative rotations: frames and positions follow from the socket outward.
    const chain = (rotations: (i: number, out: THREE.Quaternion) => THREE.Quaternion) => {
      for (let i = 0; i < segments.length; i++) {
        rotations(i, qb);
        if (i === 0) F[0].copy(qb); else F[i].multiplyQuaternions(F[i - 1], qb);
        step.copy(restDir).applyQuaternion(F[i]);
        P[i + 1].copy(P[i]).addScaledVector(step, segments[i].length);
      }
    };
    // The wag for a given size and phases: accumulated swing about the body's vertical, applied to the held pose.
    const wag = (size: number, ph: number, slow: number) => {
      let total = WAG.centre;
      for (let i = 0; i < segments.length; i++) {
        const wave = Math.sin(ph - WAG.lag * i) + .3 * Math.sin(slow - WAG.lag * .7 * i + 1.3);
        total += size * (i === 0 ? WAG.root : WAG.follow * weight[i]) * wave;
        F[i].multiplyQuaternions(qw.setFromAxisAngle(upAxis, total), holdWorld[i]);
        step.copy(restDir).applyQuaternion(F[i]);
        P[i + 1].copy(P[i]).addScaledVector(step, segments[i].length);
      }
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
      const row = anim.quats[anim.frames.indexOf(anim.hold)];
      const world = order.map((_, i) => new THREE.Quaternion(row[i * 4], row[i * 4 + 1], row[i * 4 + 2], row[i * 4 + 3]));
      hold = world.map((q, i) => i === 0 ? q : world[i - 1].clone().invert().multiply(q));
      chain((i, out) => out.copy(hold[i]));

      const m = new THREE.Matrix4().fromArray(data.camera.matrix);
      m.decompose(camera.position, camera.quaternion, new THREE.Vector3());
      camera.updateMatrixWorld();
      holdWorld = F.map(f => f.clone());
      // The body's vertical: from the feet to the top of the head.
      upAxis.subVectors(v(data.body.HeadTop_End), v(data.body.LeftFoot).add(v(data.body.RightFoot)).multiplyScalar(.5)).normalize();
      const n = segments.length;
      weight = segments.map((_, i) => .35 + .65 * i / (n - 1));

      // Everything the tail sweeps through at its widest (a fresh click), so framing leaves room for it.
      const reachPoints: THREE.Vector3[] = [];
      for (let k = 0; k < 48; k++) {
        const ph = k / 48 * Math.PI * 2;
        wag(1 + KICK.gain, ph, ph * .53);
        P.forEach(p => reachPoints.push(p.clone()));
      }
      chain((i, out) => out.copy(hold[i]));

      const b = (k: string) => v(data.body[k]);
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
      const dt = lastTime < 0 ? 0 : Math.min(.05, now - lastTime); lastTime = now;
      // A click's kick eases in over a moment rather than jumping, then fades.
      if (kickTarget > 0) { kick += (kickTarget - kick) * (1 - Math.exp(-dt * 4)); if (kickTarget - kick < .02) kickTarget = 0; }
      else kick *= Math.exp(-dt / KICK.decay);
      // Phases advance by speed, so a click speeds the wag up without a jump in its position.
      phase += dt * (WAG.speed + KICK.speed * kick);
      slowPhase += dt * WAG.speed * .53;
      wag(1 + .2 * Math.sin(now * .21) + KICK.gain * kick, phase, slowPhase);
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

    // A click whips the tail; repeated clicks stack a little.
    const click = () => { kickTarget = Math.min(1.6, kick + 1); };
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
