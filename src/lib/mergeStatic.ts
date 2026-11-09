import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Collapse a glTF scene's many small meshes into one mesh per (rigid parent, material).
 * Meshes are grouped under their nearest "anchor" (an ancestor that moves on its own,
 * e.g. a robot joint, or the root), so everything that moves together is merged together
 * and still follows its anchor. Hidden meshes are dropped. Cuts draw calls by ~10x.
 */
export function mergeStatic(root: THREE.Object3D, isAnchor: (o: THREE.Object3D) => boolean) {
  root.updateMatrixWorld(true);
  type Group = { anchor: THREE.Object3D; material: THREE.Material; meshes: THREE.Mesh[]; cast: boolean; receive: boolean };
  const groups = new Map<string, Group>();
  const drop: THREE.Mesh[] = [];

  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as any).isSkinnedMesh || Array.isArray(m.material) || m.morphTargetInfluences) return;
    if (!m.visible) {
      drop.push(m);
      return;
    }
    let a: THREE.Object3D | null = m.parent;
    while (a && a !== root && !isAnchor(a)) a = a.parent;
    const anchor = a ?? root;
    const g = m.geometry;
    const sig = Object.entries(g.attributes)
      .map(([k, v]) => `${k}:${v.itemSize}:${v.normalized}:${(v as THREE.BufferAttribute).array?.constructor.name}`)
      .sort()
      .join(',');
    const key = `${anchor.uuid}|${m.material.uuid}|${sig}|${m.castShadow}|${m.receiveShadow}`;
    let grp = groups.get(key);
    if (!grp) {
      grp = { anchor, material: m.material, meshes: [], cast: m.castShadow, receive: m.receiveShadow };
      groups.set(key, grp);
    }
    grp.meshes.push(m);
  });

  drop.forEach((m) => {
    m.parent?.remove(m);
    m.geometry.dispose();
  });

  const inv = new THREE.Matrix4();
  const rel = new THREE.Matrix4();
  let before = 0;
  let after = 0;
  for (const grp of groups.values()) {
    before += grp.meshes.length;
    if (grp.meshes.length < 2) {
      after += grp.meshes.length;
      continue;
    }
    inv.copy(grp.anchor.matrixWorld).invert();
    const geos = grp.meshes.map((m) => {
      rel.multiplyMatrices(inv, m.matrixWorld);
      let g = m.geometry.clone();
      if (!g.index) {
        const n = g.attributes.position.count;
        g.setIndex(Array.from({ length: n }, (_, i) => i));
      }
      g.applyMatrix4(rel);
      // mirrored transforms flip triangle winding; flip it back so back-face culling stays right
      if (rel.determinant() < 0) {
        const idx = g.index!;
        for (let i = 0; i < idx.count; i += 3) {
          const b = idx.getX(i + 1);
          idx.setX(i + 1, idx.getX(i + 2));
          idx.setX(i + 2, b);
        }
      }
      g.morphAttributes = {};
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) {
      after += grp.meshes.length;
      continue;
    }
    const mesh = new THREE.Mesh(merged, grp.material);
    mesh.castShadow = grp.cast;
    mesh.receiveShadow = grp.receive;
    mesh.name = `merged_${grp.material.name}`;
    grp.anchor.add(mesh);
    grp.meshes.forEach((m) => {
      m.parent?.remove(m);
      m.geometry.dispose();
    });
    after += 1;
  }
  return { before, after };
}
