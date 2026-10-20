const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const THREE = require('three');
const root = path.resolve(__dirname, '../public/lab');
const binary = fs.readFileSync(path.join(root, 'horse.glb'));
assert.equal(binary.readUInt32LE(0), 0x46546c67);
const gltf = JSON.parse(binary.toString('utf8', 20, 20 + binary.readUInt32LE(12)));
const clip = JSON.parse(fs.readFileSync(path.join(root, 'horse-motion.json')));
assert.equal(gltf.skins?.length || 0, 0, 'Only evaluated rigid shells may ship');
assert.equal(gltf.cameras?.length || 0, 0, 'Do not publish scene cameras');
assert.equal(gltf.images?.length || 0, 0, 'Do not publish source textures');
assert.ok(binary.length < 3_000_000, 'Keep the web model lightweight');
assert.equal(clip.parts.length, 56);
assert.equal(clip.fps, 25);
assert.equal(clip.last - clip.first + 1, 80);
const bounds = new THREE.Box3();
let moving = 0;
for (const part of clip.parts) {
  const node = gltf.nodes.find(node => node.name === part.name);
  assert.ok(node && node.mesh !== undefined, `Missing shell ${part.name}`);
  assert.equal(part.poses.length, 80);
  for (const values of part.poses) {
    assert.equal(values.length, 16); assert.ok(values.every(Number.isFinite));
    const matrix = new THREE.Matrix4().fromArray(values);
    assert.ok(Math.abs(matrix.determinant() - 1) < .001, 'Pose must remain rigid');
  }
  if (part.poses.some(pose => pose.some((n, i) => Math.abs(n - part.poses[0][i]) > .001))) moving++;
  const initial = new THREE.Matrix4().fromArray(part.poses[0]);
  assert.ok(initial.elements.every((n, i) => Math.abs(n - new THREE.Matrix4().elements[i]) < 1e-5), 'Bind-space first pose must be identity within Blender float precision');
  for (const primitive of gltf.meshes[node.mesh].primitives) {
    const accessor = gltf.accessors[primitive.attributes.POSITION];
    bounds.union(new THREE.Box3(new THREE.Vector3().fromArray(accessor.min), new THREE.Vector3().fromArray(accessor.max)));
  }
}
assert.ok(moving >= 20, 'The original motion must actually animate the legs');
const size = bounds.getSize(new THREE.Vector3());
assert.ok(size.x > 3 && size.x < 3.3 && size.y > 1 && size.y < 2 && size.z < 1, 'GLB must use the same upright Y-up space as the pose cache');
console.log(`Passed: 56 HORSE shells, ${moving} moving parts, 80 native poses at 25 fps, upright bind space, asset budget/privacy checks. GLB ${(binary.length / 1e6).toFixed(2)} MB.`);
