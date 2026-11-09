import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

// Experimental: real-time three.js version of the Blender "robot hands designing a car" scene.
export default function RobotLab() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [fps, setFps] = useState(0);
  const [cinematic, setCinematic] = useState(true);
  const cinematicRef = useRef(true);
  cinematicRef.current = cinematic;

  useEffect(() => {
    const mount = mountRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0c0e);
    scene.fog = new THREE.Fog(0x0c0c0e, 14, 40);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;

    const freeCam = new THREE.PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 0.05, 200);
    freeCam.position.set(0, 2.2, 9);
    let activeCam: THREE.PerspectiveCamera = freeCam;
    let gltfCam: THREE.PerspectiveCamera | null = null;

    const controls = new OrbitControls(freeCam, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.9, 0);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 2;
    controls.maxDistance = 20;

    // Key + rim lights (Blender lights are not exported)
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(1.5, 10, -4); // overhead/back, like the studio area lights — keeps floor specular out of frame
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -8; key.shadow.camera.right = 8;
    key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
    key.shadow.bias = -0.0005;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfd4ff, 0.6);
    rim.position.set(-6, 5, 6);
    scene.add(rim);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, activeCam);
    composer.addPass(renderPass);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(mount.clientWidth, mount.clientHeight), 0.35, 0.6, 0.9));
    composer.addPass(new OutputPass());

    // Glossy epoxy floor: planar mirror just under the (semi-transparent) floor mesh
    const reflector = new Reflector(new THREE.PlaneGeometry(60, 60), {
      textureWidth: Math.floor(mount.clientWidth * 0.6),
      textureHeight: Math.floor(mount.clientHeight * 0.6),
      color: 0x8a8a90,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = -0.002;
    scene.add(reflector);

    const carPaint = new THREE.MeshPhysicalMaterial({
      name: 'Web_CarPaint', color: 0x6e0b10, metalness: 0.55, roughness: 0.32,
      clearcoat: 1, clearcoatRoughness: 0.04,
    });

    let mixer: THREE.AnimationMixer | null = null;
    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    loader.load(
      '/models/robot_cell.glb',
      (gltf) => {
        gltf.scene.traverse((o: any) => {
          // Cycles volume box — meaningless in WebGL (scene.fog replaces it)
          if (o.name === 'Haze') o.visible = false;
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            // three.js only supports uv..uv3; remap any extra UV channels
            // Car paint was a layered Cycles shader → rebuild as clearcoat paint
            if (/car paint/i.test(o.material?.name ?? '')) o.material = carPaint;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m: any) => {
              Object.values(m).forEach((v: any) => {
                if (v && v.isTexture && v.channel > 3) v.channel = 0;
              });
              // Cycles emission strengths are far too hot for a real-time tonemapper
              if (m.emissive) {
                const e = (m.emissive.r + m.emissive.g + m.emissive.b) * (m.emissiveIntensity ?? 1);
                if (e > 2.5) m.emissiveIntensity = (m.emissiveIntensity ?? 1) * (2.5 / e);
              }
              // Procedural Blender materials that don't survive glTF export
              if (m.name === 'Floor_Epoxy') {
                m.color.set(0x0e0e10); m.roughness = 0.22; m.metalness = 0.0; m.map = null;
                m.envMapIntensity = 0.9;
                // semi-transparent so the planar Reflector underneath shows through
                m.transparent = true; m.opacity = 0.82;
              }
              if (m.name === 'Wall_Frosted') { m.emissiveIntensity *= 0.6; }
              // Transmission = extra full-scene render pass; cheap alpha glass instead
              if (m.transmission > 0) {
                m.transmission = 0; m.transparent = true; m.opacity = 0.3;
                m.roughness = Math.min(m.roughness, 0.05); m.depthWrite = false;
              }
              m.needsUpdate = true;
            });
          }
          if (o.isCamera && !gltfCam) gltfCam = o;
        });
        scene.add(gltf.scene);
        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(gltf.scene);
          gltf.animations.forEach((clip) => mixer!.clipAction(clip).play());
        }
        if (gltfCam) {
          gltfCam.aspect = mount.clientWidth / mount.clientHeight;
          gltfCam.updateProjectionMatrix();
        }
        setLoaded(true);
      },
      (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      (err) => console.error(err),
    );

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      [freeCam, gltfCam].forEach((c) => { if (c) { c.aspect = w / h; c.updateProjectionMatrix(); } });
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frames = 0, acc = 0, raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = clock.getDelta();
      mixer?.update(dt);
      activeCam = cinematicRef.current && gltfCam ? gltfCam : freeCam;
      renderPass.camera = activeCam;
      if (activeCam === freeCam) controls.update();
      composer.render();
      frames++; acc += dt;
      if (acc > 0.5) { setFps(Math.round(frames / acc)); frames = 0; acc = 0; }
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      draco.dispose();
      composer.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0c0c0e] text-white" style={{ fontFamily: 'ui-monospace, monospace' }}>
      <div ref={mountRef} className="absolute inset-0" />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-xs tracking-[0.3em] text-white/60">
          LOADING {progress}%
        </div>
      )}
      <div className="absolute left-4 bottom-4 right-4 flex flex-wrap items-center justify-between gap-2 text-[10px] tracking-[0.2em] text-white/50 pointer-events-none">
        <span>ROBOT CELL — BLENDER → THREE.JS · {fps} FPS</span>
        <button
          className="pointer-events-auto border border-white/30 px-3 py-1.5 hover:bg-white/10"
          onClick={() => setCinematic((c) => !c)}
        >
          {cinematic ? 'CINEMATIC CAM · TAP FOR FREE LOOK' : 'FREE LOOK · DRAG TO ORBIT'}
        </button>
      </div>
    </div>
  );
}
