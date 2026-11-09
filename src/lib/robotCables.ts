import * as THREE from 'three';

// Robot wires/conduits were Blender bezier curves hooked to the arm joints.
// glTF can't carry hooks, so the curves are exported as data
// (each control point / handle relative to its joint) and rebuilt here every frame.

type Ref = { hook: string | null; p: [number, number, number] };
type CablePoint = { r: number; handle_left: Ref; co: Ref; handle_right: Ref };
export type CableData = {
  name: string;
  robot: string;
  thick: number;
  mat: { name: string | null; color?: [number, number, number]; metal?: number; rough?: number };
  points: CablePoint[];
};

const SEG_PER_SPAN = 8;
const RADIAL = 6;

export class RobotCable {
  mesh: THREE.Mesh;
  robot: string;
  private refs: { obj: THREE.Object3D | null; local: THREE.Vector3 }[] = [];
  private world: THREE.Vector3[] = [];
  private samples: THREE.Vector3[];
  private radius: number;
  private spans: number;

  constructor(data: CableData, root: THREE.Object3D, material: THREE.Material) {
    this.robot = data.robot;
    const avgR = data.points.reduce((s, p) => s + p.r, 0) / data.points.length;
    this.radius = data.thick * avgR;
    for (const pt of data.points) {
      for (const ref of [pt.handle_left, pt.co, pt.handle_right]) {
        const obj = ref.hook ? root.getObjectByName(ref.hook) ?? null : null;
        this.refs.push({ obj, local: new THREE.Vector3(...ref.p) });
        this.world.push(new THREE.Vector3());
      }
    }
    this.spans = data.points.length - 1;
    const n = this.spans * SEG_PER_SPAN + 1;
    this.samples = Array.from({ length: n }, () => new THREE.Vector3());

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * (RADIAL + 1) * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * (RADIAL + 1) * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++)
      for (let j = 0; j < RADIAL; j++) {
        const a = i * (RADIAL + 1) + j, b = (i + 1) * (RADIAL + 1) + j;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.name = data.name;
  }

  update() {
    // control points/handles -> world
    for (let i = 0; i < this.refs.length; i++) {
      const { obj, local } = this.refs[i];
      this.world[i].copy(local);
      if (obj) this.world[i].applyMatrix4(obj.matrixWorld);
    }
    // sample the cubic bezier spans
    let k = 0;
    for (let s = 0; s < this.spans; s++) {
      const p0 = this.world[s * 3 + 1], p1 = this.world[s * 3 + 2], p2 = this.world[s * 3 + 3], p3 = this.world[s * 3 + 4];
      for (let j = s === 0 ? 0 : 1; j <= SEG_PER_SPAN; j++) {
        const t = j / SEG_PER_SPAN, u = 1 - t;
        const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        this.samples[k++].set(
          a * p0.x + b * p1.x + c * p2.x + d * p3.x,
          a * p0.y + b * p1.y + c * p2.y + d * p3.y,
          a * p0.z + b * p1.z + c * p2.z + d * p3.z,
        );
      }
    }
    // tube with parallel-transport frames (no twisting)
    const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const nor = this.mesh.geometry.attributes.normal as THREE.BufferAttribute;
    const n = this.samples.length;
    const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), prevT = new THREE.Vector3();
    const v = new THREE.Vector3(), q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const a = this.samples[Math.max(0, i - 1)], b = this.samples[Math.min(n - 1, i + 1)];
      T.subVectors(b, a);
      if (T.lengthSq() < 1e-12) T.copy(prevT.lengthSq() ? prevT : v.set(0, 1, 0));
      T.normalize();
      if (i === 0) {
        N.set(0, 1, 0);
        if (Math.abs(T.y) > 0.9) N.set(1, 0, 0);
        N.crossVectors(T, N).normalize();
      } else {
        q.setFromUnitVectors(prevT, T);
        N.applyQuaternion(q).normalize();
      }
      B.crossVectors(T, N);
      prevT.copy(T);
      const P = this.samples[i];
      for (let j = 0; j <= RADIAL; j++) {
        const ang = (j / RADIAL) * Math.PI * 2;
        const cs = Math.cos(ang), sn = Math.sin(ang);
        v.set(cs * N.x + sn * B.x, cs * N.y + sn * B.y, cs * N.z + sn * B.z);
        const o = i * (RADIAL + 1) + j;
        nor.setXYZ(o, v.x, v.y, v.z);
        pos.setXYZ(o, P.x + v.x * this.radius, P.y + v.y * this.radius, P.z + v.z * this.radius);
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
  }
}

export function cableMaterial(data: CableData, cache: Map<string, THREE.Material>) {
  const key = data.mat.name ?? 'default';
  let m = cache.get(key);
  if (!m) {
    const c = data.mat.color ?? [0.02, 0.02, 0.02];
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setRGB(c[0], c[1], c[2]),
      metalness: data.mat.metal ?? 0,
      roughness: data.mat.rough ?? 0.5,
    });
    cache.set(key, m);
  }
  return m;
}
