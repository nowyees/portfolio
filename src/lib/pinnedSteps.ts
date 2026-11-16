// Pinned studies change scene every PIN_STEP of a screen's height of scrolling; on a wheel or trackpad one push moves one scene.
export const PIN_STEP = .6;

export function pinnedStepIndex(offset: number, step: number, count: number) {
  return Math.max(0, Math.min(count - 1, Math.round(offset / Math.max(1, step))));
}
