import * as THREE from 'three';

/** The same normals as three's toCreasedNormals (BufferGeometryUtils), computed several times faster, for the large
 *  CAD meshes the motion pieces load. Corners whose positions fall in the same 1/100 cell share normals; each corner
 *  gets the sum of the face normals there that are within the crease angle of its own face, normalised. Faces with
 *  exactly the same normal at a place are counted together, so big flat or revolved fans cost one comparison per
 *  distinct direction instead of one per triangle. Returns a new, non-indexed geometry with position and normal. */
export function creasedNormals(geometry: THREE.BufferGeometry, creaseAngle: number) {
  const limit = Math.cos(creaseAngle), m = (1 + 1e-10) * 1e2;
  const source = geometry.attributes.position, index = geometry.index;
  const corners = index ? index.count : source.count, faces = corners / 3;
  const position = new Float32Array(corners * 3), normal = new Float32Array(corners * 3), face = new Float32Array(faces * 3);
  for (let c = 0; c < corners; c++) {
    const v = index ? index.getX(c) : c;
    position[3 * c] = source.getX(v); position[3 * c + 1] = source.getY(v); position[3 * c + 2] = source.getZ(v);
  }
  for (let f = 0; f < faces; f++) {
    const a = 9 * f;
    const ux = position[a + 6] - position[a + 3], uy = position[a + 7] - position[a + 4], uz = position[a + 8] - position[a + 5];
    const vx = position[a] - position[a + 3], vy = position[a + 1] - position[a + 4], vz = position[a + 2] - position[a + 5];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx, l = Math.hypot(x, y, z) || 1;
    face[3 * f] = x / l; face[3 * f + 1] = y / l; face[3 * f + 2] = z / l;
  }
  // Number the distinct face normals (exactly equal ones share a number), with an open-addressed table on their bits.
  const bits = new Uint32Array(face.buffer), kind = new Int32Array(faces);
  const size = 1 << Math.ceil(Math.log2(faces * 2 + 2)), table = new Int32Array(size).fill(-1);
  for (let f = 0; f < faces; f++) {
    const a = bits[3 * f], b = bits[3 * f + 1], c = bits[3 * f + 2];
    let h = (Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca77) ^ Math.imul(c, 0xc2b2ae3d)) & (size - 1);
    for (;;) {
      const e = table[h];
      if (e < 0) { table[h] = f; kind[f] = f; break; }
      if (bits[3 * e] === a && bits[3 * e + 1] === b && bits[3 * e + 2] === c) { kind[f] = e; break; }
      h = (h + 1) & (size - 1);
    }
  }
  // Group the corners by cell (one number per cell while every coordinate is within ±655 units, else its text).
  const cells = new Map<number | string, number>(), cellOf = new Int32Array(corners);
  for (let c = 0; c < corners; c++) {
    const x = ~~(position[3 * c] * m), y = ~~(position[3 * c + 1] * m), z = ~~(position[3 * c + 2] * m);
    const key = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) < 65536 ? ((x + 65536) * 131072 + y + 65536) * 131072 + z + 65536 : `${x},${y},${z}`;
    let id = cells.get(key); if (id === undefined) { id = cells.size; cells.set(key, id); }
    cellOf[c] = id;
  }
  const n = cells.size, start = new Int32Array(n + 1);
  for (let c = 0; c < corners; c++) start[cellOf[c] + 1]++;
  for (let g = 0; g < n; g++) start[g + 1] += start[g];
  const order = new Int32Array(corners), fill = start.slice(0, n);
  for (let c = 0; c < corners; c++) order[fill[cellOf[c]]++] = c;
  // Per cell: its distinct face normals (with how many faces have each) and, for each, the normal its corners get.
  let most = 0; for (let g = 0; g < n; g++) most = Math.max(most, start[g + 1] - start[g]);
  const nx = new Float32Array(most), ny = new Float32Array(most), nz = new Float32Array(most), weight = new Int32Array(most);
  const sx = new Float32Array(most), sy = new Float32Array(most), sz = new Float32Array(most), slot = new Int32Array(most);
  const seenIn = new Int32Array(faces).fill(-1), seenAs = new Int32Array(faces);   // per normal: last cell, its slot there
  for (let g = 0; g < n; g++) {
    const from = start[g], to = start[g + 1];
    let d = 0;
    for (let k = from; k < to; k++) {
      const f = (order[k] / 3) | 0, id = kind[f];
      if (seenIn[id] !== g) { seenIn[id] = g; seenAs[id] = d; nx[d] = face[3 * f]; ny[d] = face[3 * f + 1]; nz[d] = face[3 * f + 2]; weight[d] = 0; d++; }
      const j = seenAs[id]; weight[j]++; slot[k - from] = j;
    }
    for (let i = 0; i < d; i++) {
      let x = 0, y = 0, z = 0;
      for (let j = 0; j < d; j++) {
        if (nx[i] * nx[j] + ny[i] * ny[j] + nz[i] * nz[j] > limit) { x += nx[j] * weight[j]; y += ny[j] * weight[j]; z += nz[j] * weight[j]; }
      }
      const l = Math.hypot(x, y, z) || 1; sx[i] = x / l; sy[i] = y / l; sz[i] = z / l;
    }
    for (let k = from; k < to; k++) {
      const c = order[k], j = slot[k - from];
      normal[3 * c] = sx[j]; normal[3 * c + 1] = sy[j]; normal[3 * c + 2] = sz[j];
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3)); out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  return out;
}
