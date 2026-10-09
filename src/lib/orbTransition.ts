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
 * The Space scene sinks away from the camera (smaller, blurrier, fainter), then the project
 * surfaces from that same depth. The new page is caught by a MutationObserver so its entry
 * animation is applied before its first paint — no flash of the settled page.
 */
export function recedeIntoProject(scene: HTMLElement, origin: { x: number; y: number }, go: () => void) {
  // origin is in viewport coordinates; the scene pivots in its own box, the arriving page starts at scroll 0.
  const box = scene.getBoundingClientRect();
  scene.style.transformOrigin = (origin.x - box.left) + 'px ' + (origin.y - box.top) + 'px';
  const pivot = origin.x + 'px ' + origin.y + 'px';
  const recede = scene.animate([
    { transform: 'scale(1)', filter: 'blur(0px)', opacity: 1 },
    { transform: 'scale(.8)', filter: 'blur(14px)', opacity: 0 },
  ], { duration: 650, easing: 'cubic-bezier(.55,0,.75,.3)', fill: 'forwards' });
  recede.onfinish = () => {
    const previous = document.getElementById('page-content');
    const watcher = new MutationObserver(() => {
      const page = document.getElementById('page-content');
      if (!page || page === previous) return;
      watcher.disconnect();
      page.style.animation = 'none';
      page.style.transformOrigin = pivot;
      page.animate([
        { transform: 'scale(.92)', filter: 'blur(12px)', opacity: 0 },
        { transform: 'none', filter: 'none', opacity: 1 },
      ], { duration: 900, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }).onfinish = () => { page.style.transformOrigin = ''; };
    });
    watcher.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => watcher.disconnect(), 3000);
    go();
  };
}
