import type { Vector3 } from 'three';

/** Closest distance between finite segments, including parallel and zero-length links. */
export function segmentDistanceSquared(a: Vector3, b: Vector3, c: Vector3, d: Vector3) {
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const vx = d.x - c.x, vy = d.y - c.y, vz = d.z - c.z;
  const rx = a.x - c.x, ry = a.y - c.y, rz = a.z - c.z;
  const A = ux * ux + uy * uy + uz * uz, E = vx * vx + vy * vy + vz * vz;
  const B = ux * vx + uy * vy + uz * vz, C = ux * rx + uy * ry + uz * rz, F = vx * rx + vy * ry + vz * rz;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  let s = 0, t = 0;
  if (A < 1e-12) t = E < 1e-12 ? 0 : clamp(F / E);
  else if (E < 1e-12) s = clamp(-C / A);
  else {
    const denominator = A * E - B * B;
    s = denominator > 1e-15 ? clamp((B * F - C * E) / denominator) : 0;
    t = (B * s + F) / E;
    if (t < 0) { t = 0; s = clamp(-C / A); }
    else if (t > 1) { t = 1; s = clamp((B - C) / A); }
  }
  return (rx + ux * s - vx * t) ** 2 + (ry + uy * s - vy * t) ** 2 + (rz + uz * s - vz * t) ** 2;
}
