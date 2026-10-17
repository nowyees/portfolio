import * as THREE from 'three';
import { segmentDistanceSquared } from './fingerClearance';

// Slightly below the authored neutral hand's minimum link spacing (12.8 mm),
// so beginning a small gesture does not abruptly relocate the thumb mount.
const THUMB_CLEARANCE = .012;

export type RobotSelection = 'head' | 'torso' | 'base' | `arm_${string}` | `hand_${string}` | `finger_${string}` | `wheel_${string}` | `rail_${string}`;
export type RobotMetadata = {
  hands: Record<string, Array<{ name: string; parent: string | null; matrix: number[]; open: number[]; closed: number[]; rail: number[]; head: number[]; tail: number[] }>>;
  wheels: Record<string, { pivot: number[]; radius: number }>;
  head: Array<{ name: string; count: number; indexCount: number; base: number; indices: number; morphs: Record<string, number>; scale: number }>;
};

export const robotLabels: Record<string, string> = {
  head: 'Head', torso: 'Torso', base: 'Wheelbase', arm_L: 'Left arm', arm_R: 'Right arm',
  hand_L: 'Left hand', hand_R: 'Right hand',
  rail_L: 'Left thumb rail', rail_R: 'Right thumb rail',
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
  const wrists: Record<string, { pivot: THREE.Group; axis: THREE.Vector3 }> = {};
  type Gesture = { elapsed: number; duration: number; from: number[]; to: number[] };
  const flips: Record<string, Gesture> = {}, grips: Record<string, Gesture> = {};
  const flipped: Record<string, boolean> = {}, opened: Record<string, boolean> = {};
  const wheels: Array<{ group: THREE.Group; key: RobotSelection; radius: number }> = [];
  type Transform = { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 };
  const joints: Array<{ group: THREE.Group; rest: Transform; open: Transform; closed: Transform; rail: Transform; isRail: boolean; finger: string; side: string }> = [];
  const links: Array<{ group: THREE.Group; localTail: THREE.Vector3; a: THREE.Vector3; b: THREE.Vector3; side: string; thumb: boolean }> = [];
  const safeThumb: Record<string, { signature: string; curl: number; rail: number }> = {};
  const values: Record<string, number[]> = { head: [0, 0], torso: [0], base: [0, 0], arm_L: [0], arm_R: [0], hand_L: [0], hand_R: [0] };
  const meshes: THREE.Mesh[] = [];
  const soft: Array<{ mesh: THREE.Mesh; base: Float32Array; morphs: Record<string, Int16Array>; scale: number }> = [];
  let headDirty = true;
  const get = (key: string) => key.endsWith('_THUMB') ? [values[key]?.[0] || 0, values[`rail_${key.split('_')[1]}`]?.[0] || 0] : [...(values[key] || [0])];
  const set = (key: string, channel: number, value: number) => {
    const side = key.split('_')[1];
    if (/^(hand|finger)_/.test(key)) delete grips[side];
    if (key.startsWith('rail_') || key.endsWith('_THUMB') && channel === 1) delete flips[side];
    if (key.endsWith('_THUMB') && channel === 1) { values[`rail_${key.split('_')[1]}`] = [value]; return; }
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
    values[`rail_${side}`] = [0];
    values[`wrist_${side}`] = [0];
    const hand = new THREE.Group(); hands[side] = hand; upperContent.add(hand);
    // The outer hand is driven by the baked arm pose. Rotate an inner wrist
    // instead, around its actual longitudinal axis, without changing bind space.
    const wrist = bones.find(b => b.name === 'DEF_hand')!;
    const pivot = new THREE.Group(), content = new THREE.Group();
    pivot.position.fromArray(wrist.head); content.position.copy(pivot.position).negate();
    hand.add(pivot); pivot.add(content);
    wrists[side] = { pivot, axis: new THREE.Vector3().fromArray(wrist.tail).sub(pivot.position).normalize() };
    const groups = new Map<string, THREE.Group>(), world = new Map(bones.map(b => [b.name, new THREE.Matrix4().fromArray(b.matrix)]));
    for (const b of bones) groups.set(b.name, new THREE.Group());
    for (const b of bones) {
      const group = groups.get(b.name)!, parent = b.parent && groups.get(b.parent);
      (parent || content).add(group);
      const matrix = world.get(b.name)!.clone();
      if (parent) matrix.premultiply(world.get(b.parent!)!.clone().invert());
      decompose(matrix, group);
      const finger = fingerKey(side, b.name);
      if (finger.startsWith('finger_')) {
        const localPose = (kind: 'open' | 'closed' | 'rail'): Transform => {
          const pose = new THREE.Matrix4().fromArray(b[kind]);
          const parentBone = bones.find(p => p.name === b.parent);
          if (parentBone) pose.premultiply(new THREE.Matrix4().fromArray(parentBone[kind]).invert());
          const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
          pose.decompose(p, q, s); return { p, q, s };
        };
        values[finger] ||= [0];
        joints.push({ group, finger, side, isRail: b.name === 'MCH_THUMB_RAIL', rest: { p: group.position.clone(), q: group.quaternion.clone(), s: group.scale.clone() }, open: localPose('open'), closed: localPose('closed'), rail: localPose('rail') });
        if (b.name.endsWith('_MID') || b.name.endsWith('_TIP')) links.push({ group, localTail: new THREE.Vector3().fromArray(b.tail).applyMatrix4(world.get(b.name)!.clone().invert()), a: new THREE.Vector3(), b: new THREE.Vector3(), side, thumb: b.name.includes('THUMB') });
      }
    }
    for (const b of bones) {
      const object = model.getObjectByName(`robot_finger_${side}_${b.name}`);
      if (!(object instanceof THREE.Mesh)) continue;
      groups.get(b.name)!.add(object); object.matrixAutoUpdate = false; object.matrix.copy(world.get(b.name)!).invert();
      object.userData.control = b.name === 'MCH_THUMB_RAIL' ? `rail_${side}` : fingerKey(side, b.name); meshes.push(object);
    }
    const palm = model.getObjectByName(`robot_palm_${side}`);
    if (palm instanceof THREE.Mesh) { content.add(palm); palm.userData.control = `hand_${side}`; meshes.push(palm); }
  }
  const fingerNames = ['THUMB', 'INDEX', 'MIDDLE', 'RING', 'PINKY'];
  const toggleFlip = (side: string) => {
    if (!hands[side]) return;
    flipped[side] = !flipped[side];
    flips[side] = { elapsed: 0, duration: 1.05,
      from: [values[`rail_${side}`][0], values[`wrist_${side}`][0]],
      to: [flipped[side] ? 1 : 0, flipped[side] ? (side === 'L' ? Math.PI : -Math.PI) : 0] };
  };
  const toggleGrip = (side: string) => {
    if (!hands[side]) return;
    opened[side] = !opened[side];
    const target = opened[side] ? -.4 : .55;
    grips[side] = { elapsed: 0, duration: .7,
      from: fingerNames.map(f => values[`finger_${side}_${f}`]?.[0] || 0), to: fingerNames.map(() => target) };
  };
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
  const applyJoint = (joint: typeof joints[number], curl: number, rail: number) => {
    const pose = joint.isRail ? joint.rail : curl < 0 ? joint.open : joint.closed;
    const t = joint.isRail ? rail : Math.abs(curl);
    joint.group.position.lerpVectors(joint.rest.p, pose.p, t);
    joint.group.quaternion.slerpQuaternions(joint.rest.q, pose.q, t);
    joint.group.scale.lerpVectors(joint.rest.s, pose.s, t);
  };
  const clearance = (side: string) => {
    hands[side].updateWorldMatrix(true, true);
    const fingers = links.filter(link => link.side === side);
    for (const link of fingers) { link.a.setFromMatrixPosition(link.group.matrixWorld); link.b.copy(link.localTail).applyMatrix4(link.group.matrixWorld); }
    let distance = Infinity;
    for (const thumb of fingers.filter(link => link.thumb)) for (const finger of fingers.filter(link => !link.thumb)) distance = Math.min(distance, segmentDistanceSquared(thumb.a, thumb.b, finger.a, finger.b));
    return Math.sqrt(distance);
  };
  const applyThumb = (side: string, curl: number, rail: number) => {
    for (const joint of joints) if (joint.side === side && joint.finger.endsWith('_THUMB')) applyJoint(joint, curl, rail);
  };
  const update = (dt = 1 / 60) => {
    const advance = (gesture: Gesture) => {
      gesture.elapsed = Math.min(gesture.duration, gesture.elapsed + Math.max(0, dt));
      const t = gesture.elapsed / gesture.duration;
      return t * t * t * (t * (t * 6 - 15) + 10);
    };
    for (const [side, gesture] of Object.entries(flips)) {
      const t = advance(gesture);
      values[`rail_${side}`][0] = THREE.MathUtils.lerp(gesture.from[0], gesture.to[0], t);
      values[`wrist_${side}`][0] = THREE.MathUtils.lerp(gesture.from[1], gesture.to[1], t);
      if (gesture.elapsed === gesture.duration) delete flips[side];
    }
    for (const [side, gesture] of Object.entries(grips)) {
      const t = advance(gesture);
      fingerNames.forEach((finger, i) => { values[`finger_${side}_${finger}`][0] = THREE.MathUtils.lerp(gesture.from[i], gesture.to[i], t); });
      values[`hand_${side}`][0] = values[`finger_${side}_INDEX`][0];
      if (gesture.elapsed === gesture.duration) delete grips[side];
    }
    for (const [side, wrist] of Object.entries(wrists)) wrist.pivot.quaternion.setFromAxisAngle(wrist.axis, values[`wrist_${side}`][0]);
    root.rotation.y = values.base[0]; root.position.z = values.base[1]; upper.rotation.x = values.torso[0];
    for (const wheel of wheels) wheel.group.rotation.x = values[wheel.key][0] + values.base[1] / wheel.radius;
    for (const joint of joints) {
      const curl = values[joint.finger]?.[0] || 0;
      applyJoint(joint, curl, values[`rail_${joint.side}`][0]);
    }
    // Treat rigid finger links as capsules. When a requested thumb fold would enter
    // another finger, stop the thumb outside it; the other fingers keep their grip.
    for (const side of Object.keys(hands)) {
      const rawCurl = values[`finger_${side}_THUMB`]?.[0] || 0, rawRail = values[`rail_${side}`][0];
      const signature = ['THUMB', 'INDEX', 'MIDDLE', 'RING', 'PINKY'].map(f => values[`finger_${side}_${f}`]?.[0] || 0).concat(rawRail).join(',');
      if (safeThumb[side]?.signature !== signature) {
        let curl = rawCurl, rail = rawRail, best = clearance(side);
        const active = signature.split(',').some(v => Math.abs(Number(v)) > .0001);
        if (active && best < THUMB_CLEARANCE) {
          let found = false;
          const railCandidates = [rawRail, ...Array.from({ length: 21 }, (_, i) => i / 20).sort((a, b) => Math.abs(a - rawRail) - Math.abs(b - rawRail))];
          for (const candidateRail of railCandidates) {
            for (let step = 0; step <= 20; step++) {
              const candidateCurl = rawCurl - (rawCurl + 1) * step / 20;
              applyThumb(side, candidateCurl, candidateRail);
              const distance = clearance(side);
              if (distance > best) { best = distance; curl = candidateCurl; rail = candidateRail; }
              if (distance >= THUMB_CLEARANCE) { curl = candidateCurl; rail = candidateRail; found = true; break; }
            }
            if (found) break;
          }
        }
        safeThumb[side] = { signature, curl, rail };
      }
      applyThumb(side, safeThumb[side].curl, safeThumb[side].rail);
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
  const reset = () => {
    for (const key of Object.keys(values)) values[key].fill(0);
    for (const side of Object.keys(hands)) { delete flips[side]; delete grips[side]; flipped[side] = false; opened[side] = false; }
    headDirty = true;
  };
  return { root, upperContent, hands, meshes, get, set, update, reset, toggleFlip, toggleGrip,
    isAnimating: () => Object.keys(flips).length + Object.keys(grips).length > 0, thumbClearance: clearance };
}
