// E-ink look for a live piece (trial: add ?eink to the Lab address).
// The piece keeps drawing as usual underneath; a paper-coloured sheet on top copies it a few times a second,
// squeezes it to four greys with an ordered dither, leaves a faint ghost of what was there before (as a partial
// e-paper refresh does) and now and then clears that ghost with the black-white flash of a full refresh.

const PAPER: [number, number, number] = [232, 230, 223];
const INK: [number, number, number] = [28, 28, 30];
const LEVELS = 4;            // greys the panel can show
const PIXEL = 2;             // one panel dot = 2x2 screen pixels
const REFRESH_MS = 110;      // ~9 updates a second
const FULL_EVERY = 45;       // a full (flashing) refresh after this many partial ones
const GHOST = 0.22;          // how much of the previous picture survives a partial refresh

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export function attachEInk(host: HTMLElement) {
  const sheet = document.createElement('canvas');
  sheet.className = 'eink-sheet';
  sheet.setAttribute('aria-hidden', 'true');
  host.appendChild(sheet);
  const ctx = sheet.getContext('2d', { willReadFrequently: true })!;
  const grab = document.createElement('canvas');
  const gctx = grab.getContext('2d', { willReadFrequently: true })!;
  let prev: Float32Array | null = null;
  let partial = 0, last = 0, raf = 0, flash = 0;

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (now - last < REFRESH_MS || host.closest('[data-away]')) return;
    last = now;
    const src = host.querySelector<HTMLCanvasElement>('canvas:not(.eink-sheet)');
    if (!src || !src.width) return;
    const w = Math.max(1, Math.round(host.clientWidth / PIXEL)), h = Math.max(1, Math.round(host.clientHeight / PIXEL));
    if (sheet.width !== w || sheet.height !== h) { sheet.width = grab.width = w; sheet.height = grab.height = h; prev = null; }
    // the piece's canvas is transparent where nothing is drawn: lay it on white first
    gctx.fillStyle = '#fff'; gctx.fillRect(0, 0, w, h);
    gctx.drawImage(src, 0, 0, w, h);
    const img = gctx.getImageData(0, 0, w, h), d = img.data;

    // full refresh: two frames of solid black, one of white, then a clean picture
    if (flash > 0) {
      flash--;
      ctx.fillStyle = flash >= 1 ? `rgb(${INK})` : `rgb(${PAPER})`;
      ctx.fillRect(0, 0, w, h);
      if (flash === 0) prev = null;
      return;
    }
    if (++partial >= FULL_EVERY) { partial = 0; flash = 3; return; }

    const lum = new Float32Array(w * h);
    for (let i = 0, p = 0; p < lum.length; i += 4, p++) {
      let l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      l = Math.min(1, Math.max(0, (l - 0.08) * 1.15));     // a little more contrast, as ink on paper
      if (prev) l = l * (1 - GHOST) + prev[p] * GHOST;   // the last picture shows through faintly
      lum[p] = l;
    }
    for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p++) {
      const t = BAYER[(y & 3) * 4 + (x & 3)];
      const q = Math.min(LEVELS - 1, Math.floor(lum[p] * (LEVELS - 1) + t)) / (LEVELS - 1);
      const i = p * 4;
      d[i] = INK[0] + (PAPER[0] - INK[0]) * q;
      d[i + 1] = INK[1] + (PAPER[1] - INK[1]) * q;
      d[i + 2] = INK[2] + (PAPER[2] - INK[2]) * q;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    prev = lum;
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); sheet.remove(); };
}
