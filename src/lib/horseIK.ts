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
    // The bind-pose knee, rather than the remote Blender helper, preserves the
    // exact wide low silhouette shown in the reference. Walk one foot at a time.
    const order: Record<string, number> = { HR: 0, FR: .25, HL: .5, FL: .75 };
    return { ...l, rest, pole: rest[1].clone(), offset: order[l.id] };
  });
  let x = 0, velocity = 0, phase = 0, heading = 0, facingLeft = false, activity = 0;
  let leap: { elapsed: number; from: number; to: number; direction: number } | null = null;
  const smooth = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const launch = (direction: number, limit = Infinity) => {
    if (leap) return false;
    direction = direction < 0 ? -1 : 1;
    leap = { elapsed: 0, from: x, to: clamp(x + direction * 1.25, -limit, limit), direction };
    facingLeft = direction < 0; return true;
  };
  const bodyPivot = new THREE.Vector3(0, .2, 0), body = new THREE.Matrix4();
  const errors: Record<string, number> = {};
  const update = (dt: number, targetX: number, reducedMotion = false) => {
    dt = clamp(dt, 0, .05);
    const beforeX = x;
    if (reducedMotion) leap = null;
    const desired = reducedMotion ? 0 : clamp((targetX - x) * 1.8, -.38, .38);
    velocity = THREE.MathUtils.lerp(velocity, desired, 1 - Math.exp(-dt * 16)); x += velocity * dt;
    if (Math.abs(targetX - x) < .005 && Math.abs(velocity) < .02) { x = targetX; velocity = 0; }
    let hop = 0, stretch = 0, charge = 0, landed = false;
    const leaping = !!leap;
    if (leap) {
      leap.elapsed += dt;
      const t = leap.elapsed, flight = clamp((t - .14) / .76, 0, 1);
      x = THREE.MathUtils.lerp(leap.from, leap.to, 1 - (1 - flight) ** 3);
      velocity = dt > 0 ? (x - beforeX) / dt : 0;
      hop = Math.sin(Math.PI * flight) * .56;
      charge = t < .14 ? Math.sin(Math.PI * t / .28) : (1 - smooth(flight / .18));
      stretch = smooth(flight / .18) * (1 - smooth((flight - .58) / .42));
      facingLeft = leap.direction < 0;
      if (t >= 1.04) { x = leap.to; velocity = 0; leap = null; hop = stretch = charge = 0; landed = true; }
    } else if (Math.abs(velocity) > .1) facingLeft = velocity < 0;
    heading = THREE.MathUtils.lerp(heading, facingLeft ? Math.PI : 0, 1 - Math.exp(-dt * 7));
    const speed = Math.abs(velocity), stride = .76;
    activity = THREE.MathUtils.lerp(activity, clamp(speed * 10, 0, 1), 1 - Math.exp(-dt * 8));
    phase = (phase + speed * dt * .78 / stride) % 1;
    // A quiet weight transfer, not the bounce/lean of the previous trot.
    const bob = (-.065 + Math.sin(phase * Math.PI * 8) * .008) * activity - charge * .10;
    const pitch = stretch * .10;
    body.makeTranslation(bodyPivot.x, bodyPivot.y + bob, bodyPivot.z)
      .multiply(new THREE.Matrix4().makeRotationZ(pitch)).multiply(new THREE.Matrix4().makeTranslation(-bodyPivot.x, -bodyPivot.y, -bodyPivot.z));
    const deltas: Record<string, THREE.Matrix4> = {};
    const feet: Record<string, THREE.Vector3[]> = {};
    const swinging: string[] = [];
    for (const leg of legs) {
      const p = (phase + leg.offset) % 1, stance = .78;
      const u = p < stance ? p / stance : (p - stance) / (1 - stance);
      const swing = p >= stance;
      if (swing && activity > .01) swinging.push(leg.id);
      // 78% stance leaves only one foot airborne at once. Keep each original
      // front/back spread instead of recentering all four feet under the body.
      const step = swing ? -.5 + (u * u * (3 - 2 * u)) : .5 - u;
      const hip = leg.rest[0].clone().applyMatrix4(body);
      const anchor = leg.rest.at(-1)!;
      const pair = legs.filter(other => other.id[0] === leg.id[0]);
      const centerX = pair.reduce((sum, other) => sum + other.rest.at(-1)!.x, 0) / pair.length;
      // Both feet share the same fore/aft travel interval. Half-cycle opposition
      // makes L/R actually pass each other instead of wiggling at separate anchors.
      const foot = new THREE.Vector3(THREE.MathUtils.lerp(anchor.x, centerX + step * stride, activity),
        anchor.y + (swing ? Math.sin(Math.PI * u) ** 2 * .13 * activity : 0), anchor.z);
      if (leaping) {
        const airborne = new THREE.Vector3(hip.x - (leg.id.startsWith('F') ? .99 : 1.45), hip.y - .42, anchor.z);
        foot.lerp(airborne, stretch);
      }
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
    return { x, y: hop, velocity, heading, activity, phase, feet, errors, swinging, leaping, landed, stretch };
  };
  return { update, launch };
}
