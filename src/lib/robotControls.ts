import * as THREE from 'three';

export type RobotSelection = 'head' | 'torso' | 'base' | `arm_${string}` | `hand_${string}` | `finger_${string}` | `wheel_${string}`;
export type RobotMetadata = {
  hands: Record<string, Array<{ name: string; parent: string | null; matrix: number[]; open: number[]; closed: number[]; head: number[]; tail: number[] }>>;
  wheels: Record<string, { pivot: number[]; radius: number }>;
  head: Array<{ name: string; count: number; indexCount: number; base: number; indices: number; morphs: Record<string, number>; scale: number }>;
};

export const robotLabels: Record<string, string> = {
  head: 'Head', torso: 'Torso', base: 'Wheelbase', arm_L: 'Left arm', arm_R: 'Right arm',
  hand_L: 'Left hand', hand_R: 'Right hand',
  wheel_FRONT_NEG_X: 'Front right wheel', wheel_FRONT_POS_X: 'Front left wheel',
  wheel_REAR_NEG_X: 'Rear right wheel', wheel_REAR_POS_X: 'Rear left wheel',
  INDEX: 'Index', MIDDLE: 'Middle', RING: 'Ring', PINKY: 'Little finger', THUMB: 'Thumb',
};
export function controlLabel(selection: string) {
  if (robotLabels[selection]) return robotLabels[selection];
  if (selection.startsWith('finger_')) return `${selection.split('_')[1] === 'L' ? 'Left' : 'Right'} ${robotLabels[selection.split('_')[2]]?.toLowerCase() || 'finger'}`;
  return selection.includes('NEG_X') ? 'Right wheel' : 'Left wheel';
}

/** Native head shape keys, rigid finger hierarchies and actual wheel pivots from Blender. */
export function createRobotControls(model: THREE.Object3D, metadata: RobotMetadata, binary: ArrayBuffer, material: THREE.Material) {
  const root = new THREE.Group();
  const upper = new THREE.Group(), upperContent = new THREE.Group();
  upper.position.y = .43; upperContent.position.y = -.43; upper.add(upperContent); root.add(upper);
  const hands: Record<string, THREE.Group> = {};
  const wheels: Array<{ group: THREE.Group; key: RobotSelection; radius: number }> = [];
  type Transform = { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 };
  const joints: Array<{ group: THREE.Group; rest: Transform; open: Transform; closed: Transform; finger: string }> = [];
  const values: Record<string, number[]> = { head: [0, 0], torso: [0], base: [0, 0], arm_L: [0], arm_R: [0], hand_L: [0], hand_R: [0] };
  const meshes: THREE.Mesh[] = [];
  const soft: Array<{ mesh: THREE.Mesh; base: Float32Array; morphs: Record<string, Int16Array>; scale: number }> = [];
  let headDirty = true;
  const get = (key: string) => [...(values[key] || [0])];
  const set = (key: string, channel: number, value: number) => {
    values[key] ||= [0]; values[key][channel] = value;
    if (key === 'head') headDirty = true;
    if (key.startsWith('hand_')) {
      const side = key.split('_')[1];
      for (const finger of ['THUMB', 'INDEX', 'MIDDLE', 'RING', 'PINKY']) values[`finger_${side}_${finger}`] = [value];
    }
  };
  const decompose = (matrix: THREE.Matrix4, group: THREE.Object3D) => matrix.decompose(group.position, group.quaternion, group.scale);
  const fingerKey = (side: string, bone: string): RobotSelection => {
    const finger = ['THUMB', 'INDEX', 'MIDDLE', 'RING', 'PINKY'].find(f => bone.includes(f));
    return finger ? `finger_${side}_${finger}` : `hand_${side}`;
  };
  for (const [side, bones] of Object.entries(metadata.hands)) {
    const hand = new THREE.Group(); hands[side] = hand; upperContent.add(hand);
    const groups = new Map<string, THREE.Group>(), world = new Map(bones.map(b => [b.name, new THREE.Matrix4().fromArray(b.matrix)]));
    for (const b of bones) groups.set(b.name, new THREE.Group());
    for (const b of bones) {
      const group = groups.get(b.name)!, parent = b.parent && groups.get(b.parent);
      (parent || hand).add(group);
      const matrix = world.get(b.name)!.clone();
      if (parent) matrix.premultiply(world.get(b.parent!)!.clone().invert());
      decompose(matrix, group);
      const finger = fingerKey(side, b.name);
      if (finger.startsWith('finger_')) {
        const localPose = (kind: 'open' | 'closed'): Transform => {
          const pose = new THREE.Matrix4().fromArray(b[kind]);
          const parentBone = bones.find(p => p.name === b.parent);
          if (parentBone) pose.premultiply(new THREE.Matrix4().fromArray(parentBone[kind]).invert());
          const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
          pose.decompose(p, q, s); return { p, q, s };
        };
        values[finger] ||= [0];
        joints.push({ group, finger, rest: { p: group.position.clone(), q: group.quaternion.clone(), s: group.scale.clone() }, open: localPose('open'), closed: localPose('closed') });
      }
    }
    for (const b of bones) {
      const object = model.getObjectByName(`robot_finger_${side}_${b.name}`);
      if (!(object instanceof THREE.Mesh)) continue;
      groups.get(b.name)!.add(object); object.matrixAutoUpdate = false; object.matrix.copy(world.get(b.name)!).invert();
      object.userData.control = fingerKey(side, b.name); meshes.push(object);
    }
    const palm = model.getObjectByName(`robot_palm_${side}`);
    if (palm instanceof THREE.Mesh) { hand.add(palm); palm.userData.control = `hand_${side}`; meshes.push(palm); }
  }
  for (const [name, data] of Object.entries(metadata.wheels)) {
    const object = model.getObjectByName(name);
    if (!(object instanceof THREE.Mesh)) continue;
    const group = new THREE.Group(); group.position.fromArray(data.pivot); root.add(group);
    group.add(object); object.position.copy(group.position).negate();
    const key = name.replace('robot_', '') as RobotSelection;
    object.userData.control = key; meshes.push(object); wheels.push({ group, key, radius: data.radius }); values[key] = [0];
  }
  for (const name of ['torso', 'base']) {
    const object = model.getObjectByName('robot_' + name);
    if (object instanceof THREE.Mesh) { (name === 'torso' ? upperContent : root).add(object); object.userData.control = name; meshes.push(object); }
  }
  for (const part of metadata.head) {
    const base = new Float32Array(binary.slice(part.base, part.base + part.count * 12));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(binary.slice(part.indices, part.indices + part.indexCount * 4)), 1));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; mesh.userData.control = 'head'; upperContent.add(mesh); meshes.push(mesh);
    soft.push({ mesh, base, morphs: Object.fromEntries(Object.entries(part.morphs).map(([name, offset]) => [name, new Int16Array(binary.slice(offset, offset + part.count * 6))])), scale: part.scale });
  }
  const update = () => {
    root.rotation.y = values.base[0]; root.position.z = values.base[1]; upper.rotation.x = values.torso[0];
    for (const wheel of wheels) wheel.group.rotation.x = values[wheel.key][0] + values.base[1] / wheel.radius;
    for (const joint of joints) {
      const curl = values[joint.finger]?.[0] || 0;
      const pose = curl < 0 ? joint.open : joint.closed, t = Math.abs(curl);
      joint.group.position.lerpVectors(joint.rest.p, pose.p, t);
      joint.group.quaternion.slerpQuaternions(joint.rest.q, pose.q, t);
      joint.group.scale.lerpVectors(joint.rest.s, pose.s, t);
    }
    if (!headDirty) return;
    headDirty = false;
    const weights: Record<string, number> = {};
    for (const [axis, radians] of [['Y', values.head[0]], ['X', values.head[1]]] as const) {
      const degrees = Math.abs(THREE.MathUtils.radToDeg(radians)), sign = radians < 0 ? 'N' : 'P';
      const low = Math.floor(degrees / 15) * 15, high = low + 15, t = (degrees - low) / 15;
      if (low) weights[`SOFT_${axis}_${sign}${low}`] = 1 - t;
      if (t) weights[`SOFT_${axis}_${sign}${high}`] = t;
    }
    for (const part of soft) {
      const position = part.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const output = position.array as Float32Array; output.set(part.base);
      for (const [key, weight] of Object.entries(weights)) {
        const delta = part.morphs[key]; if (!delta) continue;
        for (let i = 0; i < output.length; i++) output[i] += delta[i] * part.scale * weight;
      }
      position.needsUpdate = true; part.mesh.geometry.computeVertexNormals();
    }
  };
  const reset = () => { for (const key of Object.keys(values)) values[key].fill(0); headDirty = true; };
  return { root, upperContent, hands, meshes, get, set, update, reset };
}
