// Shared state + helpers for the Space ⇄ Projects morph and the "pulled into a project" zoom.
// Snapshots live in module scope so they survive the route swap (pages unmount, this module doesn't).

export type SnapshotItem = { key: string; image: string; rect: { left: number; top: number; width: number; height: number } };
type Snapshot = { time: number; items: SnapshotItem[] };

const FRESH_MS = 1200;
let orbSnapshot: Snapshot | null = null;
let gridSnapshot: Snapshot | null = null;

export const projectKey = (project: { category: string; id: string | number }) => project.category + '-' + project.id;
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const easeInOut = (p: number) => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

const toRect = (r: DOMRect) => ({ left: r.left, top: r.top, width: r.width, height: r.height });
export const snapshotItem = (key: string, image: string, el: Element): SnapshotItem => ({ key, image, rect: toRect(el.getBoundingClientRect()) });

export function saveOrb(items: SnapshotItem[]) { orbSnapshot = { time: performance.now(), items }; }
export function saveGrid(items: SnapshotItem[]) { gridSnapshot = { time: performance.now(), items }; }
function take(snapshot: Snapshot | null) {
  if (!snapshot || performance.now() - snapshot.time > FRESH_MS || prefersReducedMotion()) return null;
  return snapshot.items;
}
export function takeOrb() { const items = take(orbSnapshot); orbSnapshot = null; return items; }
export function takeGrid() { const items = take(gridSnapshot); gridSnapshot = null; return items; }

/** The arriving page keeps still while pieces fly in, instead of running the default slide-in. */
export function holdPageEnter() {
  const page = document.getElementById('page-content');
  if (page) page.style.animation = 'none';
}

/** A fixed-position image used as the flying piece. */
export function makeClone(src: string, rect: SnapshotItem['rect']) {
  const clone = document.createElement('div');
  clone.className = 'orb-clone';
  Object.assign(clone.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
  const img = document.createElement('img');
  img.src = src; img.alt = ''; img.draggable = false;
  clone.appendChild(img);
  document.body.appendChild(clone);
  return clone;
}

/**
 * Clicked card rushes forward until it swallows the screen, the page swaps behind it,
 * then the image keeps flying past the camera while the project settles in underneath.
 */
export function flyIntoProject(img: HTMLImageElement, hiResSrc: string, go: () => void) {
  const from = img.getBoundingClientRect();
  const aspect = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : from.width / from.height;
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.max(vw, vh * aspect), h = w / aspect;
  const cover = { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
  const clone = makeClone(img.currentSrc || img.src, toRect(from));
  const hi = new Image();
  hi.onload = () => { const sharp = clone.appendChild(hi); sharp.className = 'orb-clone-sharp'; };
  hi.src = hiResSrc; hi.alt = '';
  const px = (r: typeof cover) => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  // Accelerating curve: slow lift-off, then a rush that doesn't stop at the screen edge.
  const rush = clone.animate([px(toRect(from)), px(cover)], { duration: 720, easing: 'cubic-bezier(.55,0,.85,.25)', fill: 'forwards' });
  rush.onfinish = () => {
    go();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const passThrough = { duration: 820, easing: 'cubic-bezier(.15,.55,.25,1)', fill: 'forwards' as const };
      clone.animate([
        { transform: 'scale(1)', filter: 'blur(0px)', opacity: 1 },
        { transform: 'scale(1.18)', filter: 'blur(6px)', opacity: .85, offset: .35 },
        { transform: 'scale(1.4)', filter: 'blur(18px)', opacity: 0 },
      ], passThrough).onfinish = () => clone.remove();
      const page = document.getElementById('page-content');
      if (page) {
        holdPageEnter();
        page.style.transformOrigin = '50% 50vh';
        page.animate([{ transform: 'scale(1.08)', filter: 'blur(8px)' }, { transform: 'none', filter: 'none' }], passThrough)
          .onfinish = () => { page.style.transformOrigin = ''; };
      }
    }));
  };
}
