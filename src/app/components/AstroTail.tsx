import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/*
 * Graduation piece: the astronaut held at frame 135 of the Blender scene, its robotic tail alive.
 * Geometry (public/lab/astro-tail.glb): one static mesh for the body + fixed tail mount, and one rigid
 *   mesh per tail bone in rest pose (the skinned hoses are split onto their dominant bones in Blender). Normals are split at 38° in Blender so only real creases draw.
 * Motion: the tail follows the cursor through the poses of its swing in the graduation film (Blender frames
 *   1-77), moving between them via the film's own in-between frames; on the left it shows the right side's poses mirrored; it holds still without a cursor.
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

    // Supersample: lines are drawn at ~2 device px then scaled down, which smooths them. The edge pass reads nine
    // texels per pixel of a large target, so on slower GPUs (or large windows) that alone can drop the page to
    // ~10 fps; `quality` scales the supersampling down while frames run slow and back up when there's headroom.
    const QUALITY = { maxPixels: 5e6, slow: 1 / 40, fast: 1 / 55, step: .1, min: .6 };
    let quality = 1, frameTime = 1 / 60, lastRender = -1, slowFor = 0, fastFor = 0;
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight, dpr = window.devicePixelRatio || 1;
      const full = Math.min(3, dpr * 2, Math.sqrt(QUALITY.maxPixels / Math.max(1, w * h)));
      const ratio = Math.max(Math.min(dpr * 1.5, full), full * quality);
      renderer.setPixelRatio(ratio); renderer.setSize(w, h);
      target.setSize(Math.round(w * ratio), Math.round(h * ratio));
      edgeMaterial.uniforms.texel.value.set(1 / (w * ratio), 1 / (h * ratio));
      camera.aspect = w / h;
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(fitY, fitX / camera.aspect) / .8));
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);

    // Tail: follows the cursor using the poses of the graduation film's swing (Blender frames 1-77). The film
    // frame whose tip lies nearest the cursor becomes the target, and the tail moves there through the film's
    // own in-between frames, so every shape is an authored one. A small lean about the socket makes up the rest.
    // Without a cursor it holds still. Rotations are interpolated per joint relative to the previous segment and
    // positions are chained from the socket, so the tail always moves as one piece.
    let segments: Array<{ group: THREE.Group; length: number }> = [];
    let P: THREE.Vector3[] = [], F: THREE.Quaternion[] = [];
    let clip: THREE.Quaternion[][] = [];  // per frame: segment 0's world rotation, then each relative to the previous
    const restDir = new THREE.Vector3();
    const viewAxis = new THREE.Vector3(); // the camera's line of sight: turning about it leans the tail across the screen
    // The film curls the tail beautifully out to the right; out to the left it folds. So the left side shows the
    // right side's poses mirrored across the body's centre plane (normal: the camera's right axis). A mirrored
    // rotation keeps its angle and flips its axis: (x, y, z, w) -> (-M(x, y, z), w) with M the reflection.
    const mirrorNormal = new THREE.Vector3();
    // To change sides the tail first swings back to the film's middle frame (the right swing's start, hanging
    // down), where a pose and its mirror image nearly agree, and flips there; blending two curled poses with their
    // mirror images would crumple the tail.
    const MIRROR = { deadZone: .03, rate: 10, near: 1.5 };  // cursor must cross the socket by `deadZone` to switch
    // The film's frames on the way back to the middle coil the tail tightly; while crossing, every bend is eased
    // off by up to `relax` and the tail moves more slowly, so it swings loosely over instead of whipping.
    const CROSS = { relax: .55, rate: 3, speed: .6 };
    let crossEase = 0, cross = 0;
    let side = 1, shown = 1, mirror = 0, middle = 50;  // cursor's side, side shown (1 right, -1 left), mirror weight, middle frame
    const reflect = (v: THREE.Vector3) => v.addScaledVector(mirrorNormal, -2 * v.dot(mirrorNormal));

    const LOOP = { first: 1, last: 77 };               // the film frames used as poses
    const START = 7;                                   // resting pose: the tail hanging straight down
    // how fast the tail eases between poses (per second), its top speed through the film (frames per second, about
    // the film's own pace), how much nearby frames are preferred over distant ones (so it doesn't scrub through the
    // whole swing for a slightly closer tip), and how far it may lean (radians)
    const FOLLOW = { rate: 5, maxSpeed: 36, stickiness: .6, lean: .35 };
    const pointer = { x: 0, y: 0, inside: false };
    let lastTime = -1, goalFrame = START, frameEase = START, current = START, lean = 0, leanEase = 0;
    let tips: THREE.Vector3[] = [];                    // tip position of each pose, unleaned
    // Poses whose sharpest joint still bends more than this are only passed through, never stopped on: held still
    // under the cursor such a bend reads as a kink.
    const HOLDABLE_BEND = THREE.MathUtils.degToRad(45);
    let holdable: boolean[] = [];
    // Follow-through: each joint follows the film frame at its own pace, quick at the socket and slower toward
    // the tip, so a moving tail trails and curls behind its root and settles into one pose when it stops.
    const TRAIL = { root: 16, tip: 3.5 };              // per-second catch-up rates at the socket and at the tip
    let jointFrames: number[] = [];

    const qb = new THREE.Quaternion(), qv = new THREE.Quaternion();
    const step = new THREE.Vector3(), tmpDir = new THREE.Vector3(), socketScreen = new THREE.Vector3();
    // The film folds one joint back on itself (up to ~150°) while the tail is out to the left; held still under
    // the cursor that reads as a kink. Bends up to a knee pass untouched; beyond it only a small share of the extra
    // bend is kept. On the left the softening is strong; it relaxes over the frames where the tail crosses to the
    // right, because there a straighter tail would pass behind the legs.
    const SOFT = { strong: { knee: 25, keep: .1 }, mild: { knee: 60, keep: .2 }, fromFrame: 44, toFrame: 58 };
    const ID = new THREE.Quaternion();
    const softness = (f: number) => 1 - THREE.MathUtils.smoothstep(f, SOFT.fromFrame, SOFT.toFrame);
    const soften = (q: THREE.Quaternion, s: number) => {
      if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      const angle = 2 * Math.acos(Math.min(1, q.w));
      const knee = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(SOFT.mild.knee, SOFT.strong.knee, s));
      const keep = THREE.MathUtils.lerp(SOFT.mild.keep, SOFT.strong.keep, s);
      if (angle > knee) q.slerpQuaternions(ID, qs.copy(q), (knee + (angle - knee) * keep) / angle);
      return q;
    };
    const qs = new THREE.Quaternion();
    // On the left the film also bunches its curl into a few short vertebrae where the thin tip begins, so the tip
    // seems to stand up from a corner. There each joint's bend is replaced by a weighted average of its
    // neighbours' (spreading the curl along the tail) and eased off a little overall.
    const SMOOTH = { radius: 5, sigma: 2.5, flatten: .25 };
    const kernel = Array.from({ length: SMOOTH.radius * 2 + 1 }, (_, k) => Math.exp(-((k - SMOOTH.radius) ** 2) / (2 * SMOOTH.sigma ** 2)));
    let bends: THREE.Vector3[] = [], spread: THREE.Vector3[] = [];
    const firstRot = new THREE.Quaternion();
    const toVector = (q: THREE.Quaternion, out: THREE.Vector3) => {
      if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      const half = Math.acos(Math.min(1, q.w)), sin = Math.sin(half);
      return sin < 1e-6 ? out.set(0, 0, 0) : out.set(q.x, q.y, q.z).multiplyScalar(2 * half / sin);
    };
    const fromVector = (v: THREE.Vector3, out: THREE.Quaternion) => {
      const angle = v.length();
      return angle < 1e-9 ? out.identity() : out.setFromAxisAngle(tmpDir.copy(v).divideScalar(angle), angle);
    };
    // Pose the chain from relative rotations, leaned about the view axis; positions follow from the socket.
    const chain = (rotations: (i: number, out: THREE.Quaternion) => THREE.Quaternion, lean: number, frame: number, mirrored = 0, relaxed = 0) => {
      const n = segments.length, s = softness(frame);
      if (bends.length !== n) { bends = segments.map(() => new THREE.Vector3()); spread = segments.map(() => new THREE.Vector3()); }
      for (let i = 0; i < n; i++) {
        rotations(i, qb);
        if (i === 0) firstRot.copy(qb); else toVector(soften(qb, s), bends[i]);
      }
      if (s > 0) {
        for (let i = 1; i < n; i++) {
          spread[i].set(0, 0, 0); let total = 0;
          for (let k = -SMOOTH.radius; k <= SMOOTH.radius; k++) {
            const j = i + k; if (j < 1 || j >= n) continue;
            spread[i].addScaledVector(bends[j], kernel[k + SMOOTH.radius]); total += kernel[k + SMOOTH.radius];
          }
          spread[i].divideScalar(total).multiplyScalar(1 - SMOOTH.flatten);
        }
        for (let i = 1; i < n; i++) bends[i].lerp(spread[i], s);
      }
      if (relaxed > 0) for (let i = 1; i < n; i++) bends[i].multiplyScalar(1 - CROSS.relax * relaxed);
      if (mirrored > 0) {
        for (let i = 1; i < n; i++) bends[i].lerp(reflect(tmpDir.copy(bends[i])).negate(), mirrored);
        reflect(tmpDir.set(firstRot.x, firstRot.y, firstRot.z)).negate();
        firstRot.slerp(qs.set(tmpDir.x, tmpDir.y, tmpDir.z, firstRot.w), mirrored);
        lean *= 1 - 2 * mirrored; // a lean about the view axis mirrors to the opposite lean
      }
      qv.setFromAxisAngle(viewAxis, lean);
      for (let i = 0; i < n; i++) {
        if (i === 0) F[0].multiplyQuaternions(qv, firstRot); else F[i].multiplyQuaternions(F[i - 1], fromVector(bends[i], qb));
        step.copy(restDir).applyQuaternion(F[i]);
        P[i + 1].copy(P[i]).addScaledVector(step, segments[i].length);
      }
    };
    const frameAt = (f: number, i: number, out: THREE.Quaternion) => {
      const k = Math.floor(f), next = Math.min(k + 1, clip.length - 1);
      return out.slerpQuaternions(clip[k][i], clip[next][i], f - k);
    };
    // Aspect-corrected screen offset of a world point from the socket.
    const screenOffset = (p: THREE.Vector3, out: THREE.Vector2) => {
      socketScreen.copy(P[0]).project(camera); pointScreen.copy(p).project(camera);
      return out.set((pointScreen.x - socketScreen.x) * camera.aspect, pointScreen.y - socketScreen.y);
    };
    const pointScreen = new THREE.Vector3(), tipOffset = new THREE.Vector2(), cursorOffset = new THREE.Vector2();

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
      mirrorNormal.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      const toView = (p: THREE.Vector3) => p.clone().applyMatrix4(camera.matrixWorldInverse);

      // Everything the tail sweeps through over the loop, leaned either way, so framing leaves room for it.
      const reachPoints: THREE.Vector3[] = [];
      for (const lean of [-FOLLOW.lean, 0, FOLLOW.lean]) {
        for (const mirrored of [0, 1]) for (const relaxed of [0, 1]) {
          clip.forEach((row, f) => { chain((i, out) => out.copy(row[i]), lean, f, mirrored, relaxed); P.forEach(p => reachPoints.push(p.clone())); });
        }
      }
      const sharpest = () => {
        let m = 0;
        for (let i = 1; i < P.length - 1; i++) m = Math.max(m, step.subVectors(P[i], P[i - 1]).normalize().angleTo(tmpDir.subVectors(P[i + 1], P[i]).normalize()));
        return m;
      };
      holdable = [];
      tips = clip.map((row, f) => {
        chain((i, out) => out.copy(row[i]), 0, f);
        holdable.push(sharpest() <= HOLDABLE_BEND);
        return P[P.length - 1].clone();
      });
      chain((i, out) => out.copy(clip[START][i]), 0, START);
      jointFrames = segments.map(() => START);

      // Centre the astronaut and everything the tail sweeps through, then remember the view angle they need.
      const pts = [...Object.values(data.body).map(v), ...reachPoints].map(toView);
      const box = new THREE.Box3().setFromPoints(pts);
      const shiftX = (box.min.x + box.max.x) / 2, shiftY = (box.min.y + box.max.y) / 2;
      camera.translateX(shiftX); camera.translateY(shiftY); camera.updateMatrixWorld();
      // The middle frame: after the left swing, the one whose tip hangs closest below the socket on screen.
      const socketView = toView(P[0]);
      let bestMiddle = Infinity;
      tips.forEach((tip, f) => {
        const q = toView(tip), x = Math.abs(q.x / -q.z - socketView.x / -socketView.z);
        if (f >= SOFT.fromFrame && q.y < socketView.y && x < bestMiddle) { bestMiddle = x; middle = f; }
      });
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
      if (pointer.inside) {
        socketScreen.copy(P[0]).project(camera);
        cursorOffset.set((pointer.x - socketScreen.x) * camera.aspect, pointer.y - socketScreen.y);
        // On the left, chase the mirror image of the cursor with the right side's poses; they are shown mirrored.
        if (cursorOffset.x > MIRROR.deadZone) side = 1; else if (cursorOffset.x < -MIRROR.deadZone) side = -1;
        cursorOffset.x *= shown;
      }
      const crossing = side !== shown;
      if (crossing) {
        // (or, if it is still nearer the resting pose, which hangs straight down too, to that)
        goalFrame = Math.abs(current - START) < Math.abs(current - middle) ? START : middle;
        if (Math.abs(current - goalFrame) < MIRROR.near && jointFrames.every(f => Math.abs(f - goalFrame) < MIRROR.near * 2)) shown = side;
      } else if (pointer.inside) {
        // The film pose whose tip is nearest the cursor, preferring poses close to the current one.
        let best = goalFrame, bestCost = Infinity;
        tips.forEach((tip, f) => {
          if (!holdable[f]) return;
          const cost = screenOffset(tip, tipOffset).distanceTo(cursorOffset) + FOLLOW.stickiness * Math.abs(f - current) / clip.length;
          if (cost < bestCost) { bestCost = cost; best = f; }
        });
        goalFrame = best;
      }
      // Two easing stages: the tail sets off and arrives softly, passing through the film's in-between frames.
      const k = 1 - Math.exp(-dt * FOLLOW.rate);
      frameEase += (goalFrame - frameEase) * k;
      const ck = 1 - Math.exp(-dt * CROSS.rate);
      crossEase += ((crossing ? 1 : 0) - crossEase) * ck; cross += (crossEase - cross) * ck;
      const maxStep = FOLLOW.maxSpeed * dt * (1 - (1 - CROSS.speed) * cross);
      current += THREE.MathUtils.clamp((frameEase - current) * k, -maxStep, maxStep);
      // Lean the whole tail about the socket so its tip points at the cursor (clockwise on screen is positive).
      let want = 0;
      if (pointer.inside && !crossing) {
        chain((i, out) => frameAt(current, i, out), 0, current);
        screenOffset(P[P.length - 1], tipOffset);
        const turn = Math.atan2(tipOffset.y, tipOffset.x) - Math.atan2(cursorOffset.y, cursorOffset.x);
        want = THREE.MathUtils.clamp(Math.atan2(Math.sin(turn), Math.cos(turn)), -FOLLOW.lean, FOLLOW.lean);
      }
      leanEase += (want - leanEase) * k; lean += (leanEase - lean) * k;
      mirror += ((shown < 0 ? 1 : 0) - mirror) * (1 - Math.exp(-dt * MIRROR.rate));
      const n = jointFrames.length;
      jointFrames.forEach((f, i) => {
        jointFrames[i] = f + (current - f) * (1 - Math.exp(-dt * THREE.MathUtils.lerp(TRAIL.root, TRAIL.tip, i / (n - 1))));
      });
      chain((i, out) => frameAt(jointFrames[i], i, out), lean, current, THREE.MathUtils.smoothstep(mirror, 0, 1), cross);
    };
    const pose = () => {
      segments.forEach((s, i) => { s.group.position.copy(P[i]); s.group.quaternion.copy(F[i]); });
    };

    const adapt = (now: number) => {
      // Long gaps are a hidden tab or a hitch, not the GPU's pace; leave them out.
      const gap = now - lastRender; lastRender = now;
      if (gap <= 0 || gap > .5) return;
      frameTime += (gap - frameTime) * .1;
      slowFor = frameTime > QUALITY.slow ? slowFor + frameTime : 0;
      fastFor = frameTime < QUALITY.fast ? fastFor + frameTime : 0;
      // Step down after half a second of slow frames; step back up only after a few seconds of fast ones.
      if (slowFor > .5 && quality > QUALITY.min) { quality = Math.max(QUALITY.min, quality - QUALITY.step); slowFor = 0; resize(); }
      else if (fastFor > 4 && quality < 1) { quality = Math.min(1, quality + QUALITY.step); fastFor = 0; resize(); }
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!segments.length) return;
      simulate(now / 1000);
      adapt(now / 1000);
      pose();
      renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.clear(); renderer.render(quadScene, quadCamera);
    };

    const move = (event: PointerEvent) => {
      const r = host.getBoundingClientRect();
      pointer.x = (event.clientX - r.left) / r.width * 2 - 1; pointer.y = -((event.clientY - r.top) / r.height * 2 - 1);
      pointer.inside = true;
    };
    const leave = () => { pointer.inside = false; };
    host.addEventListener('pointerdown', move); host.addEventListener('pointermove', move); host.addEventListener('pointerleave', leave);

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
      host.removeEventListener('pointerdown', move); host.removeEventListener('pointermove', move); host.removeEventListener('pointerleave', leave);
      scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
      target.dispose(); edgeMaterial.dispose(); normalMaterial.dispose(); draco.dispose(); renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className={className} />;
}
