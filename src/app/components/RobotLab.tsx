import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { mergeStatic } from '../../lib/mergeStatic';

RectAreaLightUniformsLib.init();
import { RobotCable, cableMaterial, mergeCables, type CableData } from '../../lib/robotCables';
import { LabAudio } from '../../lib/labAudio';

// Real-time version of the Blender "four robot arms designing a car" scene.
// Click a robot: the camera moves in and that robot reaches for the car, then everything returns.
// Click the car: all four work on it together.

const ROBOT_IDS = ['RobotFL', 'RobotFR', 'RobotRL', 'RobotRR'];
const IDLE_HINT = 'CLICK A ROBOT OR THE CAR';
// Shown inside a Lab sheet (an iframe), the scene keeps only its click cues and a sound switch; the sheet has the words.
const FRAMED = typeof window !== 'undefined' && window.top !== window.self;

// Parts too small or too tucked away to show in a shadow or in the floor's reflection (about a fifth of the triangles)
const HIDDEN_DETAIL = /^(Mesh|Leather Shader|Ceramic brake disc|Nurburgring logo diffuser)$/;

// The car's honeycomb grilles are plain sheets in the model; the material punches the holes (110k triangles saved).
// Too far away to tell the holes apart, the sheet is drawn whole and darker instead of shimmering.
const grilleHoles = (m: THREE.Material) => {
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vGrillePos;
varying vec3 vGrilleN;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
vGrillePos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vGrilleN = mat3(modelMatrix) * objectNormal;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGrillePos;
varying vec3 vGrilleN;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 an = abs(vGrilleN);
          vec2 uv = (an.x > an.y && an.x > an.z ? vGrillePos.zy : an.y > an.z ? vGrillePos.xz : vGrillePos.xy) / 0.012;
          vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
          vec2 a = mod(uv, r) - h, b = mod(uv - h, r) - h;
          vec2 g = abs(dot(a, a) < dot(b, b) ? a : b);
          float d = max(dot(g, h), g.x);
          if (fwidth(uv.x) + fwidth(uv.y) > 0.7) diffuseColor.rgb *= 0.4;
          else if (d < 0.37) discard;
        }`);
  };
  m.customProgramCacheKey = () => 'grille-holes';
};

const PASS_VERTEX = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }';

// Last full-screen pass: tone mapping, then the film look (vignette + grain), in one go.
const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: PASS_VERTEX,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){ gl_FragColor = min(texture2D(tDiffuse, vUv), vec4(40.));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      vec2 d = vUv - .5; float vig = smoothstep(.85, .25, length(d * vec2(1.15, 1.)));
      gl_FragColor.rgb *= mix(.12, 1., vig);
      gl_FragColor.rgb += (h(vUv * 1000. + fract(uTime) * 91.7) - .5) * .045; }`,
};
type Robot = {
  id: string;
  joints: { obj: THREE.Object3D; rest: THREE.Quaternion; work: THREE.Quaternion }[];
  leds: THREE.MeshStandardMaterial[];
  x: number; // 0 = rest pose, 1 = working pose
  v: number;
  target: number;
  phase: number;
  moving: boolean;
  box: THREE.Box3;
};


export default function RobotLab() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [fps, setFps] = useState(0);
  const [hint, setHint] = useState(IDLE_HINT);
  const [muted, setMuted] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  // pulsing dots over each robot's tool and the car: the cue that they can be clicked
  const hotspotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const audioRef = useRef<LabAudio | null>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    const touch = matchMedia('(pointer: coarse)').matches;
    const audio = new LabAudio();
    audioRef.current = audio;

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, touch ? 1.25 : 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const BG = 0x050506;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.FogExp2(BG, 0.065);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environmentIntensity = 0.2;
    // Reflection environment = a black room with one glowing light wall behind the cell.
    // Glossy paint and metal pick the wall up as rim highlights while their fronts stay dark.
    const buildEnv = (wallZ: number, wallY: number, wallW: number, wallH: number) => {
      const env = new THREE.Scene();
      env.background = new THREE.Color(0x010101);
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(wallW, wallH),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.95, 1).multiplyScalar(6), side: THREE.DoubleSide }),
      );
      panel.position.set(0, wallY, wallZ);
      env.add(panel);
      // overhead softbox (like the studio's area lights in Blender): upward-facing curves of the
      // paint — e.g. the hood scoop — reflect a soft light instead of a black ceiling
      const top = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 6),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.9, 0.95).multiplyScalar(1.4), side: THREE.DoubleSide }),
      );
      top.rotation.x = Math.PI / 2;
      top.position.set(0, 6.5, 0.5);
      env.add(top);
      // soft fill on the viewer's side of the room: surfaces facing the camera (the hood scoop)
      // reflect a dim grey instead of a black void
      const front = new THREE.Mesh(
        new THREE.PlaneGeometry(18, 7),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.56, 0.6), side: THREE.DoubleSide }),
      );
      front.position.set(0, 3, 9);
      env.add(front);
      // dim surround so nothing reflects pure black
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(30, 16, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.1, 0.11), side: THREE.BackSide }),
      );
      env.add(dome);
      scene.environment?.dispose();
      scene.environment = pmrem.fromScene(env, 0.04).texture;
    };
    buildEnv(-6, 3, 16, 5);

    const camera = new THREE.PerspectiveCamera(32, mount.clientWidth / mount.clientHeight, 0.05, 200);
    camera.position.set(-2.6, 1.7, 7.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0.85, 0);
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 3;
    controls.maxDistance = 9; // further limited per direction by the room walls (see keepInRoom)
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;

    // Lighting: the glowing back wall is the only light (no overhead lights) —
    // everything reads as a silhouette with rim light from behind.
    const wallWash = new THREE.RectAreaLight(0xdfe8ff, 0.7, 16, 5);
    scene.add(wallWash);
    // soft overhead spot on the car (kept low so the back wall stays the key light)
    const spot = new THREE.SpotLight(0xfff4e8, 50, 14, 0.6, 0.9, 1.6);
    // "focus" stage lighting: hovering (or working) robots keep their light, the rest of the room dims
    let focus = 0;
    // key light that swings onto the hovered robot (or the car) from the viewer's side
    const focusLight = new THREE.SpotLight(0xffffff, 0, 12, 0.32, 0.55, 1.4);
    const focusAim = new THREE.Vector3(0, 1, 0);
    scene.add(focusLight, focusLight.target);
    spot.position.set(0.3, 7, 1.2);
    spot.target.position.set(0, 0.4, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048);
    spot.shadow.bias = -0.0004;
    scene.add(spot, spot.target);

    // Glossy epoxy floor: planar mirror under the semi-transparent floor mesh
    const reflector = new Reflector(new THREE.PlaneGeometry(60, 60), {
      textureWidth: Math.floor(mount.clientWidth * (touch ? 0.35 : 0.45)),
      textureHeight: Math.floor(mount.clientHeight * (touch ? 0.35 : 0.45)),
      color: 0x3a3a3f,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = -0.002;
    scene.add(reflector);
    // The mirror re-renders the whole scene; refresh it every other frame (motion here is slow,
    // a one-frame-old reflection is invisible). Same for the spot's shadow map.
    let frameNo = 0;
    const mirrorSkip: THREE.Object3D[] = [];
    const reflect = reflector.onBeforeRender.bind(reflector);
    reflector.onBeforeRender = (...args: Parameters<typeof reflect>) => {
      if (frameNo % 2 !== 0) return;
      mirrorSkip.forEach((o) => (o.visible = false));
      reflect(...args);
      mirrorSkip.forEach((o) => (o.visible = true));
    };
    renderer.shadowMap.autoUpdate = false;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(mount.clientWidth, mount.clientHeight), 0.24, 0.25, 1.0);
    composer.addPass(bloom);
    const film = new ShaderPass(FinalShader);
    composer.addPass(film);

    // camera may go anywhere inside this box (filled from the wall meshes once loaded)
    const room = new THREE.Box3(new THREE.Vector3(-11, 0.2, -5.5), new THREE.Vector3(11, 7, 14));
    const off = new THREE.Vector3();
    const orbitPos = camera.position.clone();
    const keepInRoom = () => {
      off.subVectors(camera.position, controls.target);
      let k = 1;
      for (const ax of ['x', 'y', 'z'] as const) {
        const p = controls.target[ax] + off[ax];
        if (p > room.max[ax] && off[ax] > 0) k = Math.min(k, (room.max[ax] - controls.target[ax]) / off[ax]);
        if (p < room.min[ax] && off[ax] < 0) k = Math.min(k, (room.min[ax] - controls.target[ax]) / off[ax]);
      }
      if (k < 1) camera.position.copy(controls.target).addScaledVector(off, Math.max(k, 0.05));
    };

    const carPaint = new THREE.MeshPhysicalMaterial({
      name: 'Web_CarPaint', color: 0x5c080d, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04,
    });

    // ---- scene state
    const robots: Robot[] = [];
    const cables: RobotCable[] = [];
    let carBox = new THREE.Box3(new THREE.Vector3(-1, 0, -2.3), new THREE.Vector3(1, 1.3, 2.3));
    const timers: { at: number; fn: () => void }[] = [];
    const clock = new THREE.Clock();
    const now = () => clock.elapsedTime;
    const after = (sec: number, fn: () => void) => timers.push({ at: now() + sec, fn });
    let disposed = false;

    const draco = new DRACOLoader().setDecoderPath('/draco/');
    draco.preload();   // fetch the decoder alongside the model, not after it
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const cablesReq = fetch('/models/robot_cell_cables.json').then((r) => r.json() as Promise<CableData[]>);

    loader.load(
      '/models/robot_cell.glb?v=5',
      async (gltf) => {
        if (disposed) return;
        const T0 = performance.now(); const lap = (k: string) => import.meta.env.DEV && console.info('[lab-load]', k, Math.round(performance.now() - T0), 'ms since model ready,', Math.round(performance.now()), 'since page start');
        lap('model downloaded+decoded');
        const root = gltf.scene;
        root.traverse((o: any) => {
          if (o.name === 'Haze') o.visible = false; // Cycles volume box
          if (!o.isMesh) return;
          // grilles, brake discs and the cabin: their shadows fall where nobody can see them
          o.castShadow = !HIDDEN_DETAIL.test(o.material?.name ?? '');
          o.receiveShadow = true;
          // decimation can leave zero/NaN normals -> NaN shading
          const n = o.geometry.attributes.normal as THREE.BufferAttribute | undefined;
          if (n) {
            for (let i = 0; i < n.count; i++) {
              const x = n.getX(i), y = n.getY(i), z = n.getZ(i);
              const l = Math.hypot(x, y, z);
              if (!Number.isFinite(l) || l < 1e-6) n.setXYZ(i, 0, 1, 0);
              else if (Math.abs(l - 1) > 1e-3) n.setXYZ(i, x / l, y / l, z / l);
            }
          }
          if (/car paint/i.test(o.material?.name ?? '')) o.material = carPaint;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m: any) => {
            Object.values(m).forEach((v: any) => {
              if (v && v.isTexture && v.channel > 3) v.channel = 0; // three.js has uv..uv3 only
            });
            if (m.emissive) {
              const e = (m.emissive.r + m.emissive.g + m.emissive.b) * (m.emissiveIntensity ?? 1);
              if (e > 2.5) m.emissiveIntensity = (m.emissiveIntensity ?? 1) * (2.5 / e);
            }
            if (m.name === 'Mesh') grilleHoles(m);
            if (m.name === 'Floor_Epoxy') {
              m.color.set(0x030304); m.roughness = 0.22; m.metalness = 0; m.map = null;
              m.envMapIntensity = 0.12; m.transparent = true; m.opacity = 0.86;
            }
            // back wall is a frosted light wall: bright, slightly cool, so the robots read as silhouettes
            if (m.name === 'Wall_Frosted') {
              // backlit frosted panels, every tile the same brightness
              m.color.set(0x000000);
              m.emissive.setRGB(0.88, 0.93, 1.0);
              m.emissiveIntensity = 4.5; // reads as white, not grey
              m.roughness = 0.6;
            }
            if (m.transmission > 0) {
              m.transmission = 0; m.transparent = true; m.depthWrite = false;
              m.roughness = Math.min(m.roughness, 0.05);
              // car glazing reads as dark tinted glass; small coloured lamp lenses keep their tint
              if (/window|windshield|glass\.00\d|^glass$/i.test(m.name)) { m.color.set(0x0b0c0e); m.opacity = 0.7; }
              else m.opacity = 0.3;
            }
            m.needsUpdate = true;
          });
        });
        lap('materials+normals');
        scene.add(root);
        root.updateMatrixWorld(true);

        // ---- robots: read rest/work poses from the Blender clips, then drive the joints ourselves
        const mixer = new THREE.AnimationMixer(root);
        const actions = gltf.animations.map((c) => {
          const a = mixer.clipAction(c);
          a.play();
          a.paused = true;
          return a;
        });
        const sample = (atEnd: boolean) => {
          actions.forEach((a) => (a.time = atEnd ? a.getClip().duration : 0));
          mixer.update(0);
        };
        for (const id of ROBOT_IDS) {
          const robotRoot = root.getObjectByName(id);
          if (!robotRoot) continue;
          const joints: Robot['joints'] = [];
          robotRoot.traverse((o) => {
            if (/_J\d$/.test(o.name)) joints.push({ obj: o, rest: new THREE.Quaternion(), work: new THREE.Quaternion() });
          });
          robots.push({
            id, joints, leds: [], x: 0, v: 0, target: 0, phase: robots.length * 1.7, moving: false,
            box: new THREE.Box3().setFromObject(robotRoot).expandByScalar(0.05),
          });
        }
        sample(false);
        robots.forEach((r) => r.joints.forEach((j) => j.rest.copy(j.obj.quaternion)));
        sample(true);
        robots.forEach((r) => r.joints.forEach((j) => j.work.copy(j.obj.quaternion)));
        mixer.stopAllAction();
        robots.forEach((r) => r.joints.forEach((j) => j.obj.quaternion.copy(j.rest)));

        // per-robot LED materials so each one can glow while it works
        root.traverse((o: any) => {
          if (!o.isMesh || !/LED|Lens_Spot_(FL|FR|RL|RR)/.test(o.material?.name ?? '')) return;
          let p: THREE.Object3D | null = o;
          while (p && !ROBOT_IDS.includes(p.name)) p = p.parent;
          const r = robots.find((rr) => rr.id === p?.name);
          if (!r) return;
          o.material = o.material.clone();
          o.material.userData.base = o.material.emissiveIntensity;
          r.leds.push(o.material);
        });

        // wall wash sits just in front of the glowing back wall, facing the cell
        const backWall = root.getObjectByName('BackWall');
        if (backWall) {
          const wb = new THREE.Box3().setFromObject(backWall);
          const wc = wb.getCenter(new THREE.Vector3());
          const dir = Math.sign(-wc.z) || 1; // towards the room centre
          wallWash.position.set(wc.x, wc.y, wc.z + dir * 0.3);
          wallWash.lookAt(wc.x, wc.y * 0.6, 0);
          const size = wb.getSize(new THREE.Vector3());
          buildEnv(wc.z, wc.y, Math.max(size.x, 4), Math.max(size.y, 2));
        }
        // drop the two side control cabinets (and everything sitting inside their footprint:
        // door lines, screens, handles, vents, stack lights)
        const cabinetZones = ['Cabinet', 'Cabinet001']
          .map((n) => root.getObjectByName(n))
          .filter((o): o is THREE.Object3D => !!o)
          .map((o) => {
            const b = new THREE.Box3().setFromObject(o).expandByScalar(0.1);
            b.max.y += 1.2; // stack light pole above the cabinet
            return b;
          });
        if (cabinetZones.length) {
          const mb = new THREE.Box3();
          root.traverse((o: any) => {
            if (!o.isMesh) return;
            mb.setFromObject(o);
            if (/^(Cabinet|Stack)/.test(o.name) || cabinetZones.some((z) => z.containsBox(mb))) o.visible = false;
          });
        }

        // room interior from the wall meshes, so the camera can orbit all the way round without leaving it
        const inner = (name: string, pick: (b: THREE.Box3, c: THREE.Vector3) => void) => {
          const o = root.getObjectByName(name);
          if (!o) return;
          const b = new THREE.Box3().setFromObject(o);
          pick(b, b.getCenter(new THREE.Vector3()));
        };
        inner('WallL', (b) => (room.min.x = b.max.x));
        inner('WallR', (b) => (room.max.x = b.min.x));
        inner('BackWall', (b, c) => (c.z < 0 ? (room.min.z = b.max.z) : (room.max.z = b.min.z)));
        inner('WallFront', (b, c) => (c.z > 0 ? (room.max.z = b.min.z) : (room.min.z = b.max.z)));
        inner('Ceiling', (b) => (room.max.y = b.min.y));
        room.expandByScalar(-0.45);


        const body = root.getObjectByName('CarBody');
        if (body) carBox = new THREE.Box3().setFromObject(body).expandByScalar(0.15);

        // ---- performance: ~1,400 meshes -> one per (moving part, material)
        const merged = mergeStatic(root, (o) => /_J\d$/.test(o.name) || ROBOT_IDS.includes(o.name));
        if (import.meta.env.DEV) console.info('[robot lab] meshes', merged.before, '->', merged.after);
        root.traverse((o: any) => { if (o.isMesh && HIDDEN_DETAIL.test(o.material?.name ?? '')) mirrorSkip.push(o); });
        renderer.shadowMap.needsUpdate = true;
        lap('merged');

        // ---- live cables
        const cableData = await cablesReq;
        if (disposed) return;
        const matCache = new Map<string, THREE.Material>();
        for (const c of cableData) cables.push(new RobotCable(c, root, cableMaterial(c, matCache)));
        mergeCables(cables).forEach((m) => scene.add(m));
        root.updateMatrixWorld(true);
        cables.forEach((c) => c.update());
        lap('cables');
        // Build every material's program up front, side by side, instead of one after another inside the first frame.
        { const t = performance.now();
          renderer.setRenderTarget(composer.readBuffer);
          await renderer.compileAsync(scene, camera);
          renderer.setRenderTarget(null);
          if (disposed) return;
          import.meta.env.DEV && console.info('[lab-load] compileAsync', Math.round(performance.now() - t), 'ms'); }
        { const t = performance.now(); composer.render(); renderer.getContext().finish(); import.meta.env.DEV && console.info('[lab-load] first frame (shader compile)', Math.round(performance.now() - t), 'ms'); }
        setLoaded(true);
        if (import.meta.env.DEV) (window as any).__lab = { renderer, composer, scene, reflector, spot, camera, controls, orbitPos: () => orbitPos }; // profiling in dev only
      },
      (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      (err) => console.error(err),
    );

    // ---- clicks only move the robots; the camera stays wherever the viewer put it
    const engaged = new Set<Robot>();
    const updateHint = () =>
      setHint(engaged.size ? [...engaged].map((r) => r.id.replace('Robot', 'AXIS ')).join(' · ') + ' · WORKING' : IDLE_HINT);
    const work = (r: Robot, delay = 0) => {
      if (engaged.has(r)) return;
      engaged.add(r);
      updateHint();
      after(delay, () => (r.target = 1));
      after(delay + 3.6, () => (r.target = 0));
      after(delay + 5.2, () => {
        engaged.delete(r);
        updateHint();
      });
    };
    const focusRobot = (r: Robot) => work(r);
    // idle nudge: when nobody has clicked for a while, one robot twitches a little —
    // a hint that the arms respond, without starting a full move
    let lastInput = 0;
    let lastNudge = 0;
    let nudgeIdx = 0;
    const nudge = (t: number) => {
      if (!robots.length || engaged.size || t - lastInput < 3 || t - lastNudge < 3.5) return;
      lastNudge = t;
      const r = robots[nudgeIdx++ % robots.length];
      r.target = 0.2;
      after(0.6, () => {
        if (!engaged.has(r)) r.target = 0;
      });
    };
    const focusCar = () => robots.forEach((r, i) => work(r, i * 0.18));

    // ---- picking against per-robot / car boxes (cheap, no triangle raycast)
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const pick = (ev: PointerEvent): Robot | 'car' | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      let best: Robot | 'car' | null = null;
      let bestD = Infinity;
      for (const r of robots)
        if (ray.ray.intersectBox(r.box, hit)) {
          const d = hit.distanceTo(ray.ray.origin);
          if (d < bestD) { bestD = d; best = r; }
        }
      if (ray.ray.intersectBox(carBox, hit) && hit.distanceTo(ray.ray.origin) < bestD) best = 'car';
      return best;
    };
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      if (!audio.muted) audio.start(ROBOT_IDS.length); // audio may only start after a user gesture
    };
    const onUp = (e: PointerEvent) => {
      if (!down || !robots.length) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6) return; // a drag (orbit), not a click
      const target = pick(e);
      lastInput = now();
      if (target) setIntroDone(true);
      if (target === 'car') focusCar();
      else if (target) focusRobot(target);
    };
    let lastHover = 0;
    let hovered: Robot | 'car' | null = null;
    const onLeave = () => (hovered = null);
    const onMove = (e: PointerEvent) => {
      if (e.buttons || performance.now() - lastHover < 80) return;
      lastHover = performance.now();
      hovered = pick(e);
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
    };
    // Trackpad: two fingers turn the view, pinch zooms. A mouse wheel zooms.
    // (Handled here rather than by OrbitControls: the loop re-seats the camera from orbitPos every frame.)
    let padUntil = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const now = performance.now();
      const pad = e.deltaMode === 0 && !e.ctrlKey && (e.deltaX !== 0 || Math.abs(e.deltaY) < 40 || now < padUntil);
      if (pad) {
        padUntil = now + 250;
        const k = (2 * Math.PI) / renderer.domElement.clientHeight * 0.6;
        (controls as any)._rotateLeft(e.deltaX * k);
        (controls as any)._rotateUp(e.deltaY * k);
        return;
      }
      const dy = (e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY) * (e.ctrlKey ? 10 : 1);   // pinch arrives as small ctrl+wheel steps
      off.subVectors(orbitPos, controls.target);
      const len = Math.min(controls.maxDistance, Math.max(controls.minDistance, off.length() * Math.pow(0.95, -dy * 0.01)));
      orbitPos.copy(controls.target).addScaledVector(off.normalize(), len);
    };
    renderer.domElement.addEventListener('wheel', onWheel, { capture: true, passive: false });
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    // ---- adaptive quality: a machine that can't hold ~30fps steps down one level at a time (resolution, then the
    // floor mirror, then the glow, then resolution again) until it can. Fast machines never leave level 0.
    let quality = 0, slowFor = 0, calmUntil = performance.now() + 3000;   // measure only once loading has settled
    const stepDown = () => {
      quality++;
      mount.dataset.quality = String(quality);
      calmUntil = performance.now() + 1500;   // let each step take effect before judging again
      if (quality === 1) {
        if (renderer.getPixelRatio() <= 1) { stepDown(); return; }   // already at 1: this step would change nothing
        renderer.setPixelRatio(1); composer.setPixelRatio(1); onResize();
      }
      else if (quality === 2) reflector.visible = false;
      else if (quality === 3) bloom.enabled = false;
      else if (quality === 4) { renderer.setPixelRatio(0.7); composer.setPixelRatio(0.7); onResize(); }
    };

    // a laptop's built-in graphics won't hold the full resolution: don't make it prove that first
    const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const chip = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    if (/Intel|UHD|Iris|Mali|Adreno|PowerVR|SwiftShader|llvmpipe|Basic Render/i.test(chip) && !/Arc/i.test(chip) && renderer.getPixelRatio() > 1) stepDown();

    // ---- loop
    let frames = 0, acc = 0, raf = 0, wall = performance.now();
    const tmpV = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (awayRef.current) { clock.getDelta(); frames = 0; acc = 0; wall = performance.now(); return; }
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = now();

      nudge(t);
      for (let i = timers.length - 1; i >= 0; i--)
        if (t >= timers[i].at) {
          const fn = timers[i].fn;
          timers.splice(i, 1);
          fn();
        }

      // dim the room around whatever is hovered or working (smoothly, ~0.2s)
      // stage lighting only while hovering something idle; once clicked, the room goes back to normal for the move
      const stage = hovered === 'car' ? (engaged.size ? null : 'car') : hovered && !engaged.has(hovered) ? hovered : null;
      const want = stage ? 1 : 0;
      focus += (want - focus) * Math.min(1, dt * 7);
      const carFocus = stage === 'car';
      // the back wall's own glow stays on while hovering; only its spill and the other lights dim
      const subject = stage;
      if (subject) {
        const box = subject === 'car' ? carBox : subject.box;
        box.getCenter(tmpV);
        focusAim.lerp(tmpV, Math.min(1, dt * 8));
      }
      focusLight.target.position.copy(focusAim);
      // sit between the camera and the subject, high up, so the faces the viewer sees get lit
      focusLight.position.copy(camera.position).sub(focusAim).setY(0).normalize().multiplyScalar(3).add(focusAim).setY(focusAim.y + 4);
      focusLight.angle = subject === 'car' ? 0.5 : 0.32;
      focusLight.intensity = 160 * focus;
      wallWash.intensity = 0.7 * (1 - 0.8 * focus);
      scene.environmentIntensity = 0.2 * (1 - 0.7 * focus);
      spot.intensity = 50 * (carFocus ? 1 + 0.8 * focus : 1 - 0.75 * focus);

      // robots: critically damped spring toward the target pose + slight idle breathing (no hard cuts)
      robots.forEach((r, i) => {
        const k = 7, c = 2 * Math.sqrt(k);
        r.v += (k * (r.target - r.x) - c * r.v) * dt;
        r.x += r.v * dt;
        const speed = Math.abs(r.v);
        // the end-of-travel clunk only after a real move (an idle nudge peaks well below 0.4)
        if (speed > 0.4) r.moving = true;
        else if (r.moving && Math.abs(r.target - r.x) < 0.01) {
          r.moving = false;
          audio.clunk();
        }
        audio.setServo(i, r.target === 0.2 || (!engaged.has(r) && r.target === 0) ? speed * 0.35 : speed);
        const breathe = 0.025 * (0.5 + 0.5 * Math.sin(t * 0.7 + r.phase));
        const w = Math.min(1, Math.max(0, r.x)) * (1 - breathe) + breathe;
        r.joints.forEach((j) => j.obj.quaternion.slerpQuaternions(j.rest, j.work, w));
        const hot = hovered === r || hovered === 'car' ? 1 : 0;
        const lit = stage === r || stage === 'car' ? 1 : 0; // in the spotlight while hovered (not while moving)
        const glow = 1 + 3 * Math.min(1, Math.max(0, r.x)) + hot * 1.5 * (0.6 + 0.4 * Math.sin(t * 6));
        r.leds.forEach((m) => (m.emissiveIntensity = (m.userData.base ?? 1) * glow));
      });
      if (cables.length) {
        scene.updateMatrixWorld();
        cables.forEach((c) => c.update());
      }

      // orbit on the unclamped position, then pull the rendered camera in front of any wall,
      // so the viewing distance comes back by itself once the wall is no longer behind it
      camera.position.copy(orbitPos);
      controls.update();
      orbitPos.copy(camera.position);
      keepInRoom();
      // place hotspot dots: robots at their tool tip, the car above its roof
      if (robots.length) {
        const w = mount.clientWidth, h = mount.clientHeight;
        for (let i = 0; i <= robots.length; i++) {
          const el = hotspotRefs.current[i];
          if (!el) continue;
          const r = robots[i];
          if (r) r.joints[r.joints.length - 1].obj.getWorldPosition(tmpV);
          else carBox.getCenter(tmpV).setY(carBox.max.y + 0.1);
          tmpV.project(camera);
          const busy = r ? engaged.has(r) : engaged.size > 0;
          const visible = tmpV.z < 1 && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05 && !busy;
          el.style.opacity = visible ? '1' : '0';
          el.style.transform = `translate(${((tmpV.x + 1) / 2) * w}px, ${((1 - tmpV.y) / 2) * h}px)`;
        }
      }
      film.uniforms.uTime.value = t;
      frameNo++;
      if (frameNo % (robots.some((r) => Math.abs(r.v) > 0.02) ? 2 : 30) === 0) renderer.shadowMap.needsUpdate = true;
      composer.render();

      frames++;
      acc += dt;
      if (acc > 0.5) {
        setFps(Math.round(frames / acc));
        // real frame rate (dt is capped, so it can't tell how slow a slow machine is)
        const real = frames / ((performance.now() - wall) / 1000);
        if (performance.now() > calmUntil && quality < 4) {
          slowFor = real < 40 ? slowFor + 1 : 0;
          if (slowFor >= 2) { stepDown(); slowFor = 0; }
        }
        frames = 0;
        acc = 0;
        wall = performance.now();
      }
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('wheel', onWheel, { capture: true });
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      controls.dispose();
      draco.dispose();
      composer.dispose();
      renderer.dispose();
      audio.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  // Inside a Lab sheet: the sheet tells the scene when it scrolls out of view and back. The sound goes off as it
  // leaves and comes back on as it returns, unless the visitor had switched it off themselves.
  const mutedRef = useRef(muted); mutedRef.current = muted;
  const autoMuted = useRef(false);
  const awayRef = useRef(false);   // its sheet is off screen: stay loaded, stop drawing
  useEffect(() => {
    if (!FRAMED) return;
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      const a = audioRef.current;
      if (event.data?.robotCell === 'hidden') awayRef.current = true;
      else if (event.data?.robotCell === 'shown') awayRef.current = false;
      if (event.data?.robotCell === 'hidden' && !mutedRef.current) {
        a?.setMuted(true); setMuted(true); autoMuted.current = true;
      } else if (event.data?.robotCell === 'shown' && autoMuted.current) {
        autoMuted.current = false;
        a?.start(ROBOT_IDS.length); a?.setMuted(false); setMuted(false);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  const toggleSound = () => {
    const a = audioRef.current;
    if (!a) return;
    const m = !muted;
    autoMuted.current = false;   // the visitor's own choice wins over the automatic one
    if (!m) a.start(ROBOT_IDS.length);
    a.setMuted(m);
    setMuted(m);
  };

  return (
    <div className="fixed inset-0 bg-[#050506] text-white select-none" style={{ fontFamily: 'ui-monospace, monospace' }}>
      <div ref={mountRef} className="absolute inset-0" style={{ cursor: 'grab' }} />
      {loaded &&
        [...ROBOT_IDS, 'car'].map((id, i) => (
          <div
            key={id}
            ref={(el) => {
              hotspotRefs.current[i] = el;
            }}
            className="absolute left-0 top-0 pointer-events-none transition-opacity duration-500"
            // white with a dark halo so it reads over both the white wall and the black robots
            style={{ opacity: 0, filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.9)) drop-shadow(0 0 6px rgba(0,0,0,0.5))' }}
          >
            {/* two staggered ripples, a steady ring and a bright core */}
            <span className="absolute -left-[22px] -top-[22px] h-[44px] w-[44px] rounded-full border-2 border-white/80 animate-ping" style={{ animationDuration: '1.8s' }} />
            <span className="absolute -left-[22px] -top-[22px] h-[44px] w-[44px] rounded-full border border-white/60 animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.9s' }} />
            <span className="absolute -left-[14px] -top-[14px] h-[28px] w-[28px] rounded-full border-2 border-white/90 bg-white/15" />
            <span className="absolute -left-[4px] -top-[4px] h-[8px] w-[8px] rounded-full bg-white shadow-[0_0_10px_3px_rgba(255,255,255,0.9)]" />
          </div>
        ))}
      {loaded && !introDone && !FRAMED && (
        <div className="absolute inset-x-0 bottom-[16%] flex flex-col items-center gap-2 pointer-events-none text-center">
          <span className="text-[11px] tracking-[0.4em] text-white/85 animate-pulse">CLICK A ROBOT TO MOVE IT</span>
          <span className="text-[9px] tracking-[0.3em] text-white/40">CLICK THE CAR TO MOVE ALL FOUR · DRAG TO LOOK AROUND</span>
        </div>
      )}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] tracking-[0.35em] text-white/50">
          LOADING {progress}%
        </div>
      )}
      {FRAMED ? (
        <button className="absolute bottom-4 left-1/2 -translate-x-1/2 border border-white/30 px-3.5 py-2 text-white/85 hover:bg-white/10"
          style={{ font: "600 11px/1 'Inter Tight', sans-serif", letterSpacing: '-.01em' }} onClick={toggleSound}>
          {muted ? 'SOUND OFF' : 'SOUND ON'}
        </button>
      ) : <div className="absolute left-4 right-4 bottom-4 flex flex-wrap items-end justify-between gap-2 text-[10px] tracking-[0.25em] text-white/45 pointer-events-none">
        <div className="flex flex-col gap-1">
          <span className="text-white/75">{hint}</span>
          <span>ROBOT CELL · BLENDER → THREE.JS · {fps} FPS</span>
        </div>
        <button className="pointer-events-auto border border-white/25 px-3 py-1.5 hover:bg-white/10" onClick={toggleSound}>
          {muted ? 'SOUND OFF' : 'SOUND ON'}
        </button>
      </div>}
    </div>
  );
}
