import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/*
 * Graduation piece: the astronaut held at frame 135 of the Blender scene, its robotic tail alive.
 * Geometry (public/lab/astro-tail.glb): one static mesh for the body + fixed tail mount, and one rigid
 *   mesh per tail bone in rest pose (the skinned hoses are split onto their dominant bones in Blender). Normals are split at 38° in Blender so only real creases draw.
 * Motion: three parameters (curl, two smooth swings) shape the whole tail; a small Gauss-Newton solve each
 *   frame brings the tip to an eased target while keeping the tail out of capsules around the body.
 *   Nothing is integrated, so it cannot bounce, and the shape is a smooth curve, so it cannot kink.
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

    // Tail state. The tail is described by five numbers instead of free joint positions:
    //   swing about the view axis and about the screen's vertical, each for the near and the far half
    //   (two overlapping smooth bands), curl (x rest curvature), and the plane the rest curl bends in
    //   (rolled per band). Directions come from these; frames follow by parallel transport, so the chain is
    //   a smooth curve that cannot kink at a joint or twist along its length.
    let segments: Array<{ group: THREE.Group; length: number }> = [];
    let P: THREE.Vector3[] = [], F: THREE.Quaternion[] = [], trialP: THREE.Vector3[] = [];
    let restFrames: THREE.Quaternion[] = [], nearBand: number[] = [], farBand: number[] = [], nearCover: number[] = [], farCover: number[] = [];
    let restAxis: THREE.Vector3[] = [], restAngle: number[] = [];
    let restPenalty: number[] = [], restHidden: number[] = [];
    const view = new THREE.Matrix4();
    let viewCapsules: Array<{ a: THREE.Vector3; b: THREE.Vector3; r: number }> = [];
    let reach = 1;
    const restTip = new THREE.Vector3();
    let capsules: Array<{ a: THREE.Vector3; b: THREE.Vector3; r: number }> = [];
    // [near swing (view axis), near swing (screen up), far swing (view axis), far swing (screen up), curl,
    //  near curl-plane roll, far curl-plane roll]
    const NP = 7, HOME = [0, 0, 0, 0, 1, 0, 0];
    const LO = [-1.5, -.9, -1.5, -.9, .15, -Math.PI, -Math.PI], HI = [1.5, .9, 1.5, .9, 1.25, Math.PI, Math.PI];
    const PULL = [.02, .03, .02, .03, .08, .01, .01];
    const MAX_RATE = [2.2, 1.4, 2.2, 1.4, 1, 2.5, 2.5]; // radians (or curl) per second
    const params = HOME.slice(), smooth = HOME.slice(), trial = HOME.slice();

    const restDir = new THREE.Vector3();
    const camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), camFwd = new THREE.Vector3();
    const aim = new THREE.Vector3(), goal = new THREE.Vector3(), ease1 = new THREE.Vector3(), ease2 = new THREE.Vector3();
    const pointer = { x: 0, y: 0, last: -1e9, inside: false };
    let pointerWeight = 0;

    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), ql = new THREE.Quaternion(), qf = new THREE.Quaternion();
    const step = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3(), axisR = new THREE.Vector3();
    // Forward kinematics for a parameter set; frames are written only when `frames` is given.
    const shapeOf = (p: number[], out: THREE.Vector3[], frames?: THREE.Quaternion[]) => {
      qf.copy(restFrames[0]);
      for (let i = 0; i < segments.length; i++) {
        if (i > 0) {
          qa.setFromAxisAngle(camFwd, p[0] * nearBand[i] + p[2] * farBand[i]);
          qb.setFromAxisAngle(camUp, p[1] * nearBand[i] + p[3] * farBand[i]);
          axisR.copy(restAxis[i]).applyAxisAngle(restDir, p[5] * nearCover[i] + p[6] * farCover[i]);
          ql.setFromAxisAngle(axisR, restAngle[i] * p[4]);
          // Only the segment's direction is computed from curl and bend; the frame is then carried onto it
          // by the minimal rotation from the previous segment (parallel transport), so no roll ever builds
          // up and the vertebrae stay aligned instead of twisting along the tail.
          from.copy(restDir).applyQuaternion(qf);
          to.copy(restDir).applyQuaternion(ql.premultiply(qf)).applyQuaternion(qa.multiply(qb));
          qf.premultiply(qb.setFromUnitVectors(from, to));
        }
        if (frames) frames[i].copy(qf);
        step.copy(restDir).applyQuaternion(qf);
        out[i + 1].copy(out[i]).addScaledVector(step, segments[i].length);
      }
    };
    const seg = new THREE.Vector3(), rel = new THREE.Vector3();
    const intrusion = (p: THREE.Vector3) => {
      let worst = 0;
      for (const c of capsules) {
        seg.subVectors(c.b, c.a); rel.subVectors(p, c.a);
        const t = THREE.MathUtils.clamp(rel.dot(seg) / seg.lengthSq(), 0, 1);
        worst = Math.max(worst, c.r - rel.addScaledVector(seg, -t).length());
      }
      return worst;
    };
    // How far a point sits behind the body as seen from the camera (world units, 0 when visible).
    const vp = new THREE.Vector3(), sa = new THREE.Vector2(), sb = new THREE.Vector2(), sp = new THREE.Vector2(), sd = new THREE.Vector2();
    const hidden = (p: THREE.Vector3) => {
      vp.copy(p).applyMatrix4(view);
      const depth = -vp.z; sp.set(vp.x / depth, vp.y / depth);
      let worst = 0;
      for (const c of viewCapsules) {
        sa.set(c.a.x / -c.a.z, c.a.y / -c.a.z); sb.set(c.b.x / -c.b.z, c.b.y / -c.b.z);
        sd.subVectors(sb, sa);
        const t = THREE.MathUtils.clamp(sd.dot(sa.clone().subVectors(sp, sa)) / Math.max(sd.lengthSq(), 1e-9), 0, 1);
        const bodyDepth = -(c.a.z + (c.b.z - c.a.z) * t);
        const gap = c.r * 1.2 / bodyDepth - sp.distanceTo(sa.addScaledVector(sd, t));
        if (gap > 0 && depth > bodyDepth - c.r * .6) worst = Math.max(worst, gap * bodyDepth);
      }
      return worst;
    };
    // Penalties are exactly zero until contact, then rise with a continuous slope (quadratic, then linear),
    // so the solver never chatters at the edge of the body.
    const SOFT = .02;
    const soft = (x: number) => x <= 0 ? 0 : x < SOFT ? x * x / (2 * SOFT) : x - SOFT / 2;
    // Whether a point falls inside the body's outline on screen (depth ignored), with a small margin.
    const covered = (p: THREE.Vector3) => {
      vp.copy(p).applyMatrix4(view);
      const depth = -vp.z; sp.set(vp.x / depth, vp.y / depth);
      return viewCapsules.some(c => {
        sa.set(c.a.x / -c.a.z, c.a.y / -c.a.z); sb.set(c.b.x / -c.b.z, c.b.y / -c.b.z); sd.subVectors(sb, sa);
        const t = THREE.MathUtils.clamp(sd.dot(sa.clone().subVectors(sp, sa)) / Math.max(sd.lengthSq(), 1e-9), 0, 1);
        const bodyDepth = -(c.a.z + (c.b.z - c.a.z) * t);
        return sp.distanceTo(sa.addScaledVector(sd, t)) < c.r * 1.6 / bodyDepth;
      });
    };
    // Residuals: tip-to-target, body intrusion and occlusion beyond the rest pose's, and a gentle pull home.
    const residuals = (p: number[], target: THREE.Vector3, out: number[]) => {
      shapeOf(p, trialP);
      const tip = trialP[trialP.length - 1];
      out[0] = tip.x - target.x; out[1] = tip.y - target.y; out[2] = tip.z - target.z;
      let k = 3;
      for (let i = 1; i < trialP.length; i++) {
        out[k++] = 12 * soft(intrusion(trialP[i]) - restPenalty[i]);
        out[k++] = 70 * soft(hidden(trialP[i]) - restHidden[i]);
      }
      for (let j = 0; j < NP; j++) out[k++] = PULL[j] * (p[j] - HOME[j]) * reach;
      return out;
    };
    let r0: number[] = [], r1: number[] = [];
    let cols: number[][] = [];
    const A: number[][] = Array.from({ length: NP }, () => new Array(NP + 1).fill(0));
    const candidate = HOME.slice(), delta = HOME.slice();
    let damping = .1;
    const cost = (r: number[]) => r.reduce((sum, x) => sum + x * x, 0);
    // Levenberg-Marquardt, warm-started from the last solution. A step is kept only if it lowers the cost,
    // so for a still target the tail settles into one pose instead of hopping between two.
    const solve = (target: THREE.Vector3) => {
      for (let iter = 0; iter < 10; iter++) {
        const c0 = cost(residuals(params, target, r0));
        for (let c = 0; c < NP; c++) {
          for (let j = 0; j < NP; j++) trial[j] = params[j];
          trial[c] += 1e-3;
          residuals(trial, target, r1);
          for (let i = 0; i < r0.length; i++) cols[c][i] = (r1[i] - r0[i]) / 1e-3;
        }
        for (let attempt = 0; attempt < 4; attempt++) {
          // Normal equations (JtJ + damping * diag) x = -Jt r, solved by Gaussian elimination.
          for (let a = 0; a < NP; a++) {
            let g = 0;
            for (let i = 0; i < r0.length; i++) g += cols[a][i] * r0[i];
            A[a][NP] = -g;
            for (let b = 0; b < NP; b++) {
              let sum = 0;
              for (let i = 0; i < r0.length; i++) sum += cols[a][i] * cols[b][i];
              A[a][b] = sum;
            }
            A[a][a] = A[a][a] * (1 + damping) + 1e-6;
          }
          for (let c = 0; c < NP; c++) {
            for (let r = c + 1; r < NP; r++) {
              const f = A[r][c] / A[c][c];
              for (let k = c; k <= NP; k++) A[r][k] -= f * A[c][k];
            }
          }
          for (let r = NP - 1; r >= 0; r--) {
            let x = A[r][NP];
            for (let k = r + 1; k < NP; k++) x -= A[r][k] * delta[k];
            delta[r] = x / A[r][r];
          }
          for (let j = 0; j < NP; j++) candidate[j] = THREE.MathUtils.clamp(params[j] + delta[j], LO[j], HI[j]);
          if (cost(residuals(candidate, target, r1)) < c0) {
            for (let j = 0; j < NP; j++) params[j] = candidate[j];
            damping = Math.max(1e-3, damping * .4);
            break;
          }
          damping = Math.min(1e4, damping * 5);
        }
      }
    };

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
      trialP = P.map(p => p.clone());
      segments = order.map((n, i) => {
        const group = new THREE.Group();
        const mesh = meshes.get('seg_' + n.replace('.', '_'));
        if (mesh) { mesh.position.sub(v(data.rest[n].head)); group.add(mesh); }
        scene.add(group);
        return { group, length: P[i].distanceTo(P[i + 1]) };
      });
      reach = segments.reduce((sum, s) => sum + s.length, 0);
      restTip.copy(P[P.length - 1]);
      restDir.subVectors(v(data.rest['Bone.002'].tail), v(data.rest['Bone.002'].head)).normalize();
      // Rest frames by parallel transport along the frame-135 curve, starting from the mount's orientation.
      const q = new THREE.Quaternion().fromArray(data.baseDelta), prev = restDir.clone().applyQuaternion(q), dir = new THREE.Vector3();
      restFrames = segments.map((_, i) => {
        dir.subVectors(P[i + 1], P[i]).normalize();
        q.premultiply(new THREE.Quaternion().setFromUnitVectors(prev, dir)); prev.copy(dir);
        return q.clone();
      });
      // Each rest bend as axis + angle in the segment's own frame (axis is perpendicular to the segment).
      restAxis = []; restAngle = [];
      restFrames.forEach((f, i) => {
        const local = i === 0 ? new THREE.Quaternion() : restFrames[i - 1].clone().invert().multiply(f);
        const angle = 2 * Math.acos(THREE.MathUtils.clamp(local.w, -1, 1)), s = Math.sqrt(Math.max(1e-12, 1 - local.w * local.w));
        restAxis.push(angle > 1e-6 ? new THREE.Vector3(local.x / s, local.y / s, local.z / s) : new THREE.Vector3(1, 0, 0));
        restAngle.push(angle);
      });
      F = restFrames.map(f => f.clone());
      // Extra bend lives in two smooth, overlapping bands (near half, far half); nothing bends at the mount.
      const n = segments.length;
      const band = (centre: number, width: number) => {
        const w = segments.map((_, i) => i < 2 ? 0 : Math.exp(-Math.pow((i / (n - 1) - centre) / width, 2)));
        const total = w.reduce((a, b) => a + b, 0);
        return w.map(x => x * 2 / total);
      };
      nearBand = band(.3, .22); farBand = band(.72, .22);
      const peak = (w: number[]) => { const m = Math.max(...w); return w.map(x => x / m); };
      nearCover = peak(nearBand); farCover = peak(farBand);

      // Body as capsules (torso, head, legs, arms); the tail is kept out of them.
      const b = (k: string) => v(data.body[k]);
      capsules = [
        { a: b('Hips'), b: b('Spine2'), r: .17 }, { a: b('Spine2'), b: b('Head'), r: .15 }, { a: b('Head'), b: b('HeadTop_End'), r: .13 },
        { a: b('Hips'), b: b('LeftFoot'), r: .1 }, { a: b('Hips'), b: b('RightFoot'), r: .1 },
        { a: b('Spine2'), b: b('LeftHand'), r: .07 }, { a: b('Spine2'), b: b('RightHand'), r: .07 },
      ];
      restPenalty = P.map(p => Math.max(0, intrusion(p)));
      r0 = new Array(3 + 2 * (P.length - 1) + NP).fill(0); r1 = r0.slice();
      cols = Array.from({ length: NP }, () => r0.slice());
      goal.copy(restTip); aim.copy(restTip); ease1.copy(restTip); ease2.copy(restTip);

      const m = new THREE.Matrix4().fromArray(data.camera.matrix);
      m.decompose(camera.position, camera.quaternion, new THREE.Vector3());
      camera.updateMatrixWorld();
      // Roll the camera about its view axis until the body's feet-to-head line points straight up.
      const toView = (p: THREE.Vector3) => p.clone().applyMatrix4(camera.matrixWorldInverse);
      const feet = b('LeftFoot').add(b('RightFoot')).multiplyScalar(.5);
      const axis = toView(b('HeadTop_End')).sub(toView(feet));
      camera.rotateZ(Math.atan2(axis.y, axis.x) - Math.PI / 2);
      camera.updateMatrixWorld();
      // Centre the astronaut and the tail, leaving room for its sweep, then remember the view angle they need.
      const margin = reach * .3;
      const pts = [...Object.values(data.body).map(v), ...P].map(toView);
      const box = new THREE.Box3().setFromPoints(pts);
      const shiftX = (box.min.x + box.max.x) / 2, shiftY = (box.min.y + box.max.y) / 2;
      camera.translateX(shiftX); camera.translateY(shiftY); camera.updateMatrixWorld();
      fitX = 0; fitY = 0;
      pts.forEach(p => {
        const depth = -(p.z);
        fitX = Math.max(fitX, (Math.abs(p.x - shiftX) + margin * .5) / depth);
        fitY = Math.max(fitY, (Math.abs(p.y - shiftY) + margin * .5) / depth);
      });
      camRight.setFromMatrixColumn(camera.matrixWorld, 0);
      camUp.setFromMatrixColumn(camera.matrixWorld, 1);
      camera.getWorldDirection(camFwd);
      view.copy(camera.matrixWorldInverse);
      viewCapsules = capsules.map(c => ({ a: c.a.clone().applyMatrix4(view), b: c.b.clone().applyMatrix4(view), r: c.r }));
      restHidden = P.map(p => hidden(p));
      observer.observe(host); resize();
    };

    const tmp = new THREE.Vector3();
    const simulate = (t: number, dt: number) => {
      // Idle: a wide side-to-side sway; with a pointer the tip reaches for the cursor.
      tmp.copy(restTip).addScaledVector(camRight, Math.sin(t * .8) * reach * .38).addScaledVector(camUp, Math.sin(t * .5 + 1) * reach * .14);
      goal.lerpVectors(tmp, aim, pointerWeight);
      tmp.subVectors(goal, restTip);
      if (tmp.length() > reach * .75) goal.copy(restTip).add(tmp.setLength(reach * .75));
      // Two cascaded low-pass stages on the target: smooth start, smooth stop, no overshoot.
      const k = 1 - Math.exp(-dt * 5);
      ease1.lerp(goal, k); ease2.lerp(ease1, k);
      solve(ease2);
      // Ease toward the solved pose with a speed cap, so even a change of pose glides rather than pops.
      const ks = 1 - Math.exp(-dt * 14);
      for (let j = 0; j < NP; j++) {
        const cap = MAX_RATE[j] * dt;
        smooth[j] += THREE.MathUtils.clamp((params[j] - smooth[j]) * ks, -cap, cap);
      }
      shapeOf(smooth, P, F);
    };
    const pose = () => {
      segments.forEach((s, i) => { s.group.position.copy(P[i]); s.group.quaternion.copy(F[i]); });
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
        plane.setFromNormalAndCoplanarPoint(camFwd, restTip);
        ray.setFromCamera(ndc.set(pointer.x, pointer.y), camera);
        if (ray.ray.intersectPlane(plane, hit)) {
          // A cursor over the body would ask the tail to hide behind it; slide the aim out to the tail's side.
          for (let n = 0; n < 40 && covered(hit); n++) hit.addScaledVector(camRight, -reach * .03);
          aim.copy(hit);
        }
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
