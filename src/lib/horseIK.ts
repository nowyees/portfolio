import * as THREE from 'three';

export type HorseRig = {
  bones: Record<string, { parent: string | null; head: number[]; tail: number[] }>;
  legs: Array<{ id: string; bones: string[]; pole: number[] }>;
  parts: Array<{ name: string; bone: string }>;
};
const V = (a: number[]) => new THREE.Vector3().fromArray(a);
const clamp = THREE.MathUtils.clamp;

/** Analytic pole-constrained two-link IK in world/bind-normalized units. */
export function solveHorseTwo(root: THREE.Vector3, target: THREE.Vector3, pole: THREE.Vector3, a: number, b: number) {
  const axis = target.clone().sub(root), requested = axis.length();
  if (requested < 1e-8) axis.set(0, -1, 0); else axis.divideScalar(requested);
  const d = clamp(requested, Math.abs(a - b) + 1e-6, a + b - 1e-6);
  const bend = pole.clone().sub(root).addScaledVector(axis, -pole.clone().sub(root).dot(axis));
  if (bend.lengthSq() < 1e-10) { bend.set(1, 0, 0).addScaledVector(axis, -axis.x); if (bend.lengthSq() < 1e-10) bend.set(0, 0, 1); }
  bend.normalize();
  const along = (a * a - b * b + d * d) / (2 * d), height = Math.sqrt(Math.max(0, a * a - along * along));
  return [root.clone(), root.clone().addScaledVector(axis, along).addScaledVector(bend, height), root.clone().addScaledVector(axis, d)];
}

/** Three-link hock chain: retain its native last-link direction where reachable,
 * then solve the hip/knee against that hock. No limb scaling or pose lookup. */
export function solveHorseLeg(rest: THREE.Vector3[], root: THREE.Vector3, target: THREE.Vector3, pole: THREE.Vector3) {
  const lengths = rest.slice(1).map((p, i) => p.distanceTo(rest[i]));
  if (lengths.length === 2) return solveHorseTwo(root, target, pole, lengths[0], lengths[1]);
  const [a, b, c] = lengths, axis = target.clone().sub(root), distance = axis.length();
  if (distance >= a + b + c - 1e-5) {
    axis.normalize(); return [root.clone(), root.clone().addScaledVector(axis, a), root.clone().addScaledVector(axis, a + b), root.clone().addScaledVector(axis, a + b + c)];
  }
  const offset = rest[2].clone().sub(rest[3]).normalize(), towardHip = root.clone().sub(target).normalize();
  let hock = target.clone().addScaledVector(offset, c);
  const min = Math.abs(a - b) + 1e-5, max = a + b - 1e-5;
  if (hock.distanceTo(root) < min || hock.distanceTo(root) > max) {
    // Intersect the target's c-radius sphere with a reachable hip-distance
    // sphere. The native hock direction selects the stable side of the circle.
    const d = Math.max(1e-7, distance), reach = clamp(hock.distanceTo(root), Math.max(min, Math.abs(d - c) + 1e-5), Math.min(max, d + c - 1e-5));
    const along = (d * d + c * c - reach * reach) / (2 * d);
    const bend = offset.clone().addScaledVector(towardHip, -offset.dot(towardHip));
    if (bend.lengthSq() < 1e-10) bend.set(1, 0, 0).addScaledVector(towardHip, -towardHip.x);
    bend.normalize();
    hock = target.clone().addScaledVector(towardHip, along).addScaledVector(bend, Math.sqrt(Math.max(0, c * c - along * along)));
  }
  return [...solveHorseTwo(root, hock, pole, a, b), target.clone()];
}

/** Native rigid-shell bindings + live foot-target IK. The pose cache is not used. */
export function createHorseRunner(model: THREE.Object3D, metadata: HorseRig) {
  const bindings = metadata.parts.map(p => {
    const object = model.getObjectByName(p.name); if (!object) throw new Error(`Missing HORSE shell ${p.name}`);
    object.matrixAutoUpdate = false; return { object, bone: p.bone };
  });
  const legs = metadata.legs.map(l => {
    const rest = l.bones.map(b => V(metadata.bones[b].head)); rest.push(V(metadata.bones[l.bones.at(-1)!].tail));
    return { ...l, rest, pole: V(l.pole), offset: l.id === 'FR' || l.id === 'HL' ? 0 : .5 };
  });
  let x = 0, velocity = 0, phase = 0, heading = 0, facingLeft = false, activity = 0;
  const bodyPivot = new THREE.Vector3(0, .2, 0), body = new THREE.Matrix4();
  const errors: Record<string, number> = {};
  const update = (dt: number, targetX: number, reducedMotion = false) => {
    dt = clamp(dt, 0, .05);
    const desired = reducedMotion ? 0 : clamp((targetX - x) * 3.4, -1.65, 1.65);
    velocity = THREE.MathUtils.lerp(velocity, desired, 1 - Math.exp(-dt * 16)); x += velocity * dt;
    if (Math.abs(targetX - x) < .005 && Math.abs(velocity) < .02) { x = targetX; velocity = 0; }
    if (Math.abs(velocity) > .1) facingLeft = velocity < 0;
    heading = THREE.MathUtils.lerp(heading, facingLeft ? Math.PI : 0, 1 - Math.exp(-dt * 7));
    const speed = Math.abs(velocity), stride = .62 + Math.min(speed, 1.65) * .13;
    activity = THREE.MathUtils.lerp(activity, clamp(speed * 3, 0, 1), 1 - Math.exp(-dt * 8));
    phase = (phase + speed * dt * .58 / stride) % 1;
    const bob = Math.sin(phase * Math.PI * 4) * .025 * activity;
    const pitch = -Math.min(speed, 1.5) * .025 * activity;
    body.makeTranslation(bodyPivot.x, bodyPivot.y + bob, bodyPivot.z)
      .multiply(new THREE.Matrix4().makeRotationZ(pitch)).multiply(new THREE.Matrix4().makeTranslation(-bodyPivot.x, -bodyPivot.y, -bodyPivot.z));
    const deltas: Record<string, THREE.Matrix4> = {};
    const feet: Record<string, THREE.Vector3[]> = {};
    for (const leg of legs) {
      const p = (phase + leg.offset) % 1, stance = .58;
      const u = p < stance ? p / stance : (p - stance) / (1 - stance);
      const swing = p >= stance;
      // Stance moves backward at exactly the forward travel rate. Swing brings
      // the target forward above the floor; left/right diagonals alternate.
      const step = swing ? -.5 + (u * u * (3 - 2 * u)) : .5 - u;
      const hip = leg.rest[0].clone().applyMatrix4(body);
      const foot = new THREE.Vector3(leg.rest[0].x + (leg.id.startsWith('F') ? .05 : -.05) + step * stride * activity,
        -.66 + (swing ? Math.sin(Math.PI * u) * .24 * activity : 0), leg.rest.at(-1)!.z);
      const points = solveHorseLeg(leg.rest, hip, foot, leg.pole.clone().applyMatrix4(body)); feet[leg.id] = points;
      errors[leg.id] = points.at(-1)!.distanceTo(foot);
      leg.bones.forEach((bone, i) => {
        const q = new THREE.Quaternion().setFromUnitVectors(leg.rest[i + 1].clone().sub(leg.rest[i]).normalize(), points[i + 1].clone().sub(points[i]).normalize());
        deltas[bone] = new THREE.Matrix4().makeTranslation(points[i].x, points[i].y, points[i].z)
          .multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-leg.rest[i].x, -leg.rest[i].y, -leg.rest[i].z));
      });
    }
    const delta = (name: string): THREE.Matrix4 => deltas[name] ||= metadata.bones[name].parent ? delta(metadata.bones[name].parent!) : body.clone();
    for (const binding of bindings) binding.object.matrix.copy(delta(binding.bone));
    return { x, velocity, heading, activity, phase, feet, errors };
  };
  return { update };
}
