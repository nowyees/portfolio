// The image and its outboard labels stay inside the viewport while growing.
// Coordinates are relative to the centre of the Space stage.
export function previewFrame(x: number, y: number, viewportWidth: number, viewportHeight: number, aspect = .75) {
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : .75;
  const width = Math.max(48, Math.min(320, viewportWidth - 64, (viewportHeight - 160) * ratio));
  const halfHeight = width / ratio / 2;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  return {
    width,
    height: width / ratio,
    x: clamp(x, -viewportWidth / 2 + width / 2 + 28, viewportWidth / 2 - width / 2 - 28),
    y: clamp(y, -viewportHeight / 2 + halfHeight + 88, viewportHeight / 2 - halfHeight - 48),
  };
}
