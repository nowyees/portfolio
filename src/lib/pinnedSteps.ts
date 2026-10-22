export function pinnedStepIndex(offset: number, viewport: number, count: number) {
  return Math.max(0, Math.min(count - 1, Math.round(offset / Math.max(1, viewport))));
}

// Align a partially entered scene first; at an aligned end, let the page scroll out.
export function pinnedStepDestination(offset: number, viewport: number, count: number, direction: -1 | 1) {
  if ((direction < 0 && offset <= 0) || (direction > 0 && offset >= (count - 1) * viewport)) return null;
  const current = pinnedStepIndex(offset, viewport, count);
  if (Math.abs(offset - current * viewport) > viewport * .12) return current;
  const next = current + direction;
  return next >= 0 && next < count ? next : null;
}
