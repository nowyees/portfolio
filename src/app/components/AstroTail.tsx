import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/*
 * Graduation piece: the astronaut held at frame 135 of the Blender scene, its robotic tail alive.
 * Geometry (public/lab/astro-tail.glb): one static mesh for the body + fixed tail mount, and one rigid
 *   mesh per tail bone in rest pose (the skinned hoses are split onto their dominant bones in Blender). Normals are split at 38° in Blender so only real creases draw.
 * Motion: the tail hangs from the backpack and swings left and right like a pendulum with a whip-like tip,
 *   as in the graduation film; the cursor shifts the swing's centre and a click whips it harder.
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

    // Tail: hangs down from the backpack and swings left and right across the screen like a pendulum, the way
    // it does in the graduation film. The socket leads the swing; each vertebra bends a little further a beat
    // later, so at every turn the tip lags and curls before whipping across. A slower second wave and a
    // drifting amplitude keep it from looking mechanical. The cursor shifts where the swing is centred; a click
    // whips it wider and faster before it settles. All turning is about the camera's line of sight, so the
    // authored segment shapes are kept and nothing twists; positions are chained from the socket.
    let segments: Array<{ group: THREE.Group; length: number }> = [];
    let P: THREE.Vector3[] = [], F: THREE.Quaternion[] = [];
    let holdWorld: THREE.Quaternion[] = [];
    let weight: number[] = [];            // per joint share of the follow-through, growing toward the tip
    const upAxis = new THREE.Vector3();   // the body's vertical
    const viewAxis = new THREE.Vector3(); // the camera's line of sight: turning about it swings the tail across the screen
    const restDir = new THREE.Vector3();
    let hang = 0;                         // turn that brings the authored tail to hang straight down on screen
    const toCamera = new THREE.Quaternion(); // small turn about the vertical that keeps the hanging tail in front of the legs

    // socket swing and per-joint follow-through (radians), speed (radians/second), phase lag per joint
    const SWING = { root: .75, follow: .03, speed: 4, lag: .09, front: .3 };
    const KICK = { gain: .6, speed: 2.5, decay: 1.5 };   // a click widens the swing by `gain` and speeds it up
    const AIM = { range: .7, rate: 4 };                 // how far the cursor can shift the swing's centre, and how fast
    const pointer = { x: 0, y: 0, inside: false };
    let phase = 0, slowPhase = 0, kick = 0, kickTarget = 0, lastTime = -1;
    let aim = 0, aimEase = 0;

    const qw = new THREE.Quaternion(), step = new THREE.Vector3();
    const socketScreen = new THREE.Vector3(), screenPoint = new THREE.Vector3();
    const swing = (size: number, ph: number, slow: number, centre: number) => {
      let total = hang + centre;
      for (let i = 0; i < segments.length; i++) {
        const wave = Math.sin(ph - SWING.lag * i) + .25 * Math.sin(slow - SWING.lag * .7 * i + 1.3);
        total += size * (i === 0 ? SWING.root : SWING.follow * weight[i]) * wave;
        F[i].multiplyQuaternions(qw.setFromAxisAngle(viewAxis, total), toCamera).multiply(holdWorld[i]);
        step.copy(restDir).applyQuaternion(F[i]);
        P[i + 1].copy(P[i]).addScaledVector(step, segments[i].length);
      }
    };
    // On-screen angle (aspect-corrected) of a point seen from the socket.
    const screenAngle = (p: THREE.Vector3) => {
      socketScreen.copy(P[0]).project(camera); screenPoint.copy(p).project(camera);
      return Math.atan2(screenPoint.y - socketScreen.y, (screenPoint.x - socketScreen.x) * camera.aspect);
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
      holdWorld = order.map((_, i) => new THREE.Quaternion(row[i * 4], row[i * 4 + 1], row[i * 4 + 2], row[i * 4 + 3]));
      const n = segments.length;
      weight = segments.map((_, i) => .3 + .7 * i / (n - 1));

      const b = (k: string) => v(data.body[k]);
      upAxis.subVectors(b('HeadTop_End'), b('LeftFoot').add(b('RightFoot')).multiplyScalar(.5)).normalize();
      // Look at the astronaut squarely from behind, as in the film, so the hanging tail swings in front of the
      // legs. Same distance as the Blender scene camera; the body stands upright on screen.
      const m = new THREE.Matrix4().fromArray(data.camera.matrix);
      const sceneCamera = new THREE.Vector3().setFromMatrixPosition(m);
      const centre = b('Hips').add(b('Spine2')).multiplyScalar(.5);
      const back = new THREE.Vector3().subVectors(P[0], centre);
      back.addScaledVector(upAxis, -back.dot(upAxis)).normalize();
      camera.position.copy(centre).addScaledVector(back, sceneCamera.distanceTo(centre));
      camera.up.copy(upAxis); camera.lookAt(centre);
      camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      const toView = (p: THREE.Vector3) => p.clone().applyMatrix4(camera.matrixWorldInverse);
      camera.getWorldDirection(viewAxis);
      toCamera.setFromAxisAngle(upAxis, SWING.front);

      // Turn the authored tail (seen from the socket) until its tip hangs straight down on screen.
      hang = 0; swing(0, 0, 0, 0);
      hang = screenAngle(P[P.length - 1]) + Math.PI / 2;

      // Everything the tail sweeps through at its widest (a fresh click, centred anywhere the cursor can put it),
      // so framing leaves room for it.
      const reachPoints: THREE.Vector3[] = [];
      for (const centre of [-AIM.range, 0, AIM.range]) {
        for (let k = 0; k < 48; k++) {
          const ph = k / 48 * Math.PI * 2;
          swing(1 + KICK.gain, ph, ph * .5, centre);
          P.forEach(p => reachPoints.push(p.clone()));
        }
      }
      swing(1, 0, 0, 0);

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
      // A click's kick eases in over a moment rather than jumping, then fades.
      if (kickTarget > 0) { kick += (kickTarget - kick) * (1 - Math.exp(-dt * 4)); if (kickTarget - kick < .02) kickTarget = 0; }
      else kick *= Math.exp(-dt / KICK.decay);
      // Phases advance by speed, so a click speeds the swing up without a jump in its position.
      phase += dt * (SWING.speed + KICK.speed * kick);
      slowPhase += dt * SWING.speed * .5;
      // The cursor's side of the socket shifts the swing's centre toward it (clockwise turns are positive).
      let want = 0;
      if (pointer.inside) {
        const cursor = Math.atan2(pointer.y - socketScreen.y, (pointer.x - socketScreen.x) * camera.aspect);
        want = THREE.MathUtils.clamp(-Math.PI / 2 - cursor, -Math.PI, Math.PI);
        want = THREE.MathUtils.clamp(want > Math.PI / 2 ? Math.PI - want : want < -Math.PI / 2 ? -Math.PI - want : want, -AIM.range, AIM.range);
      }
      // Two easing stages: the centre starts and stops moving softly, with no jolt.
      const k = 1 - Math.exp(-dt * AIM.rate);
      aimEase += (want - aimEase) * k; aim += (aimEase - aim) * k;
      swing(1 + .15 * Math.sin(now * .23) + KICK.gain * kick, phase, slowPhase, aim);
      socketScreen.copy(P[0]).project(camera);
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
