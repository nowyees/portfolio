import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/*
 * Graduation piece: the astronaut held at frame 135 of the Blender scene, its robotic tail alive.
 * Geometry (public/lab/astro-tail.glb): one static mesh for the body + fixed tail mount, and one rigid
 *   mesh per tail bone in rest pose (the skinned hoses are split onto their dominant bones in Blender). Normals are split at 38° in Blender so only real creases draw.
 * Motion: a spline IK. The tail is laid along a smooth curve from the socket to the eased tip target, so it
 *   cannot kink, twist, jitter or get stuck, and the curve is kept in front of the socket so it never goes
 *   behind the body. The link leaving the socket leans down toward the target.
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

    // Tail rig: a spline IK. The tail is laid along one cubic Bezier curve from the backpack socket to the tip
    // target, segment by segment at their true lengths, with frames carried along the curve by parallel
    // transport. A curve is smooth, so the tail cannot kink or twist; nothing is solved iteratively, so it
    // cannot jitter or get stuck; and the curve's handles are kept on the camera side of the socket, so the
    // tail never goes behind the body.
    let segments: Array<{ group: THREE.Group; length: number }> = [];
    let P: THREE.Vector3[] = [], F: THREE.Quaternion[] = [];
    let reach = 1;
    const restTip = new THREE.Vector3(), restDir = new THREE.Vector3(), restFrame0 = new THREE.Quaternion();
    const socketOut = new THREE.Vector3();
    let socketDepth = 1;
    let capsules: Array<{ a: THREE.Vector3; b: THREE.Vector3; r: number }> = [];
    let viewCapsules: Array<{ a: THREE.Vector3; b: THREE.Vector3; r: number }> = [];
    const view = new THREE.Matrix4();
    const camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), camFwd = new THREE.Vector3();
    const aim = new THREE.Vector3(), goal = new THREE.Vector3(), ease1 = new THREE.Vector3(), ease2 = new THREE.Vector3();
    const pointer = { x: 0, y: 0, inside: false };
    let pointerWeight = 0;

    const LEAN = .55;   // how much the link leaving the socket turns toward the target
    const DROOP = .55;  // constant downward lean at the socket, so the tail hangs from the body
    const TIP_DROOP = .3;

    // Whether a point falls inside the body's outline on screen (depth ignored), with a small margin.
    const vp = new THREE.Vector3(), sa = new THREE.Vector2(), sb = new THREE.Vector2(), sp = new THREE.Vector2(), sd = new THREE.Vector2();
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
    // Slide a point along its camera ray so it is no deeper than the socket: same place on screen, in front.
    const toFront = (p: THREE.Vector3, margin = 1) => {
      vp.copy(p).applyMatrix4(view);
      const depth = -vp.z, limit = socketDepth - reach * .04 * margin;
      if (depth > limit) p.sub(camera.position).multiplyScalar(limit / depth).add(camera.position);
      return p;
    };

    // The curve: two Hermite pieces, socket -> middle -> tip, smooth through the middle. Any length the tail has
    // beyond the straight socket-to-tip distance is taken up by letting the middle sag downward, so slack
    // becomes a hanging arc rather than a loop or a cusp.
    const M = new THREE.Vector3(), T = new THREE.Vector3(), chord = new THREE.Vector3(), sag = new THREE.Vector3();
    const out = new THREE.Vector3(), arrive = new THREE.Vector3(), down = new THREE.Vector3();
    const m0 = new THREE.Vector3(), m1 = new THREE.Vector3(), m2 = new THREE.Vector3();
    const HALF = 110, SAMPLES = HALF * 2;
    const curve = Array.from({ length: SAMPLES + 1 }, () => new THREE.Vector3());
    const arc = new Float64Array(SAMPLES + 1);
    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
    const hermite = (a: THREE.Vector3, b: THREE.Vector3, ta: THREE.Vector3, tb: THREE.Vector3, t: number, o: THREE.Vector3) => {
      const t2 = t * t, t3 = t2 * t;
      return o.copy(a).multiplyScalar(2 * t3 - 3 * t2 + 1).addScaledVector(ta, t3 - 2 * t2 + t)
        .addScaledVector(b, -2 * t3 + 3 * t2).addScaledVector(tb, t3 - t2);
    };
    // Sample the whole curve for a given sag, pushed in front of the body; returns its length.
    const build = (amount: number) => {
      M.copy(P[0]).add(T).multiplyScalar(.5).addScaledVector(sag, amount);
      const l1 = M.distanceTo(P[0]), l2 = T.distanceTo(M);
      m0.copy(out).multiplyScalar(l1 * .8);
      m1.subVectors(T, P[0]).normalize();
      m2.copy(arrive).multiplyScalar(l2 * 1.2);
      let total = 0;
      for (let i = 0; i <= SAMPLES; i++) {
        if (i <= HALF) hermite(P[0], M, m0, tmpA.copy(m1).multiplyScalar(l1), i / HALF, curve[i]);
        else hermite(M, T, tmpA.copy(m1).multiplyScalar(l2), m2, (i - HALF) / HALF, curve[i]);
        // The clearance grows from zero at the socket, so the curve still starts exactly at the socket.
        toFront(curve[i], Math.min(1, i / (SAMPLES * .2)));
        if (i > 0) total += curve[i].distanceTo(curve[i - 1]);
        arc[i] = total;
      }
      return total;
    };
    const layOut = (tip: THREE.Vector3) => {
      T.copy(tip);
      chord.subVectors(T, P[0]);
      down.copy(camUp).negate();
      const toTip = tmpB.copy(chord).normalize();
      // Leave the socket leaning toward the target and down, and never rising more than a little.
      out.copy(socketOut).multiplyScalar(1 - LEAN).addScaledVector(toTip, LEAN).addScaledVector(down, DROOP).normalize();
      const rise = out.dot(camUp);
      if (rise > .15) out.addScaledVector(camUp, .15 - rise).normalize();
      arrive.copy(toTip).addScaledVector(down, TIP_DROOP).normalize();
      // Sag direction: perpendicular to the chord on screen, on the downward side.
      sag.crossVectors(camFwd, chord).normalize();
      if (sag.dot(down) < 0) sag.negate();
      let lo = 0, hi = reach;
      if (build(0) < reach) {
        for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (build(mid) < reach) lo = mid; else hi = mid; }
      }
      build(lo);
      // Joints at their true distances along the curve; any length left over continues along the end tangent.
      let along = 0, k = 1;
      for (let j = 1; j < P.length; j++) {
        along += segments[j - 1].length;
        while (k < SAMPLES && arc[k] < along) k++;
        if (along <= arc[SAMPLES]) {
          const f = (along - arc[k - 1]) / Math.max(1e-9, arc[k] - arc[k - 1]);
          P[j].lerpVectors(curve[k - 1], curve[k], f);
        } else {
          tmpA.subVectors(curve[SAMPLES], curve[SAMPLES - 1]).normalize();
          P[j].copy(curve[SAMPLES]).addScaledVector(tmpA, along - arc[SAMPLES]);
        }
      }
      // Frames by parallel transport from the socket's rest orientation: no roll ever builds up.
      const q = qf.copy(restFrame0);
      tmpB.copy(restDir).applyQuaternion(q);
      for (let i = 0; i < segments.length; i++) {
        tmpA.subVectors(P[i + 1], P[i]).normalize();
        q.premultiply(qs.setFromUnitVectors(tmpB, tmpA));
        F[i].copy(q); tmpB.copy(tmpA);
      }
    };
    const qf = new THREE.Quaternion(), qs = new THREE.Quaternion();

    const setup = (gltf: { scene: THREE.Group }, data: SceneData) => {
      const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
      const meshes = new Map<string, THREE.Object3D>();
      gltf.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.set(o.name, o); });
      const body = meshes.get('seg_STATIC'); if (body) scene.add(body);

      const controllers = new Set(data.ik.map(c => c.target).filter(Boolean));
      const order: string[] = [];
      // The chain starts at the link leaving the backpack socket; it pivots there.
      let name: string | undefined = 'Bone.001';
      while (name) {
        order.push(name);
        const parent: string = name;
        name = Object.keys(data.rest).find(k => data.rest[k].parent === parent && !controllers.has(k));
      }
      P = [...order.map(n => v(data.posed[n].head)), v(data.posed[order[order.length - 1]].tail)];
      segments = order.map((n, i) => {
        const group = new THREE.Group();
        const mesh = meshes.get('seg_' + n.replace('.', '_'));
        if (mesh) { mesh.position.sub(v(data.rest[n].head)); group.add(mesh); }
        scene.add(group);
        return { group, length: P[i].distanceTo(P[i + 1]) };
      });
      F = segments.map(() => new THREE.Quaternion());
      reach = segments.reduce((sum, s) => sum + s.length, 0);
      restTip.copy(P[P.length - 1]);
      restDir.subVectors(v(data.rest['Bone.001'].tail), v(data.rest['Bone.001'].head)).normalize();
      restFrame0.fromArray(data.baseDelta);
      socketOut.subVectors(P[1], P[0]).normalize();

      // Body as capsules (torso, head, legs, arms), used to keep the cursor target off the body.
      const b = (k: string) => v(data.body[k]);
      capsules = [
        { a: b('Hips'), b: b('Spine2'), r: .17 }, { a: b('Spine2'), b: b('Head'), r: .15 }, { a: b('Head'), b: b('HeadTop_End'), r: .13 },
        { a: b('Hips'), b: b('LeftFoot'), r: .1 }, { a: b('Hips'), b: b('RightFoot'), r: .1 },
        { a: b('Spine2'), b: b('LeftHand'), r: .07 }, { a: b('Spine2'), b: b('RightHand'), r: .07 },
      ];
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
      socketDepth = -P[0].clone().applyMatrix4(view).z;
      layOut(ease2);
      observer.observe(host); resize();
    };

    const tmp = new THREE.Vector3();
    const simulate = (t: number, dt: number) => {
      // Idle: the tail hangs down and out to the side and sways slowly; with a pointer the tip goes to the cursor.
      tmp.copy(P[0]).addScaledVector(camRight, -reach * (.42 + Math.sin(t * .8) * .22)).addScaledVector(camUp, -reach * (.5 + Math.sin(t * .5 + 1) * .12));
      goal.lerpVectors(tmp, aim, pointerWeight);
      // Keep the tip within the tail's comfortable reach from the socket, and in front of the body.
      tmp.subVectors(goal, P[0]);
      goal.copy(P[0]).add(tmp.setLength(THREE.MathUtils.clamp(tmp.length(), reach * .5, reach * .9)));
      toFront(goal);
      // Two cascaded low-pass stages on the target: smooth start, smooth stop, no overshoot.
      const k = 1 - Math.exp(-dt * 4);
      ease1.lerp(goal, k); ease2.lerp(ease1, k);
      layOut(ease2);
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
      // The tail keeps following while the cursor is on the scene, even when it rests; it only goes back to
      // its idle sway once the cursor leaves.
      const active = pointer.inside;
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
      pointer.inside = true;
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
