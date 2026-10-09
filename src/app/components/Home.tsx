import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import SiteShell from './SiteShell';
import { usePortfolio, imageUrl } from '../../lib/usePortfolio';
import { easeInOut, holdPageEnter, prefersReducedMotion, projectKey, recedeIntoProject, saveOrb, snapshotItem, takeGrid, type SnapshotItem } from '../../lib/orbTransition';

type Arrival = { start: number; from: Array<{ x: number; y: number; w: number } | null> };

export default function Home() {
  const projects = usePortfolio();
  const navigate = useNavigate();
  const stageRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<Array<HTMLAnchorElement | null>>([]);
  const rotation = useRef({ x: .12, y: .35, vx: 0, vy: 0, drag: false, moved: false, distance: 0, px: 0, py: 0, hover: false, leaving: 0 });
  const arrival = useRef<Arrival | null>(null);
  const pendingGrid = useRef<SnapshotItem[] | null | undefined>(undefined);
  const items = useMemo(() => {
    const thumbs = projects.filter(p => p.image).map(project => ({ project, image: project.image }));
    const extras = projects.flatMap(project => {
      const media = project.media?.find(m => m.type === 'image' && m.url !== project.image);
      return media ? [{ project, image: media.url }] : [];
    }).slice(0, 7);
    return [...thumbs, ...extras];
  }, [projects]);

  // Coming from Projects: each card starts where its tile was and gets pulled into the orb.
  useLayoutEffect(() => {
    if (pendingGrid.current === undefined) pendingGrid.current = takeGrid();
    const tiles = pendingGrid.current, stage = stageRef.current;
    if (!tiles || !stage || !items.length) return;
    pendingGrid.current = null;
    holdPageEnter();
    const box = stage.getBoundingClientRect(), cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    const used = new Set<number>();
    const from = items.map(item => {
      const index = tiles.findIndex((tile, i) => !used.has(i) && tile.key === projectKey(item.project) && tile.image === item.image);
      if (index < 0) return null;
      used.add(index);
      const r = tiles[index].rect;
      return { x: r.left + r.width / 2 - cx, y: r.top + r.height / 2 - cy, w: r.width };
    });
    from.forEach((start, i) => cardsRef.current[i]?.classList.toggle('from-grid', !!start));
    arrival.current = { start: performance.now(), from };
  }, [items]);

  // Leaving Space: remember where every card was so Projects can fly them into the grid.
  useLayoutEffect(() => () => {
    if (rotation.current.leaving) return;
    saveOrb(items.flatMap((item, i) => {
      const node = cardsRef.current[i];
      return node ? [snapshotItem(projectKey(item.project), item.image, node)] : [];
    }));
  }, [items]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, last = 0, width = stage.clientWidth, height = stage.clientHeight;
    const observer = new ResizeObserver(() => { width = stage.clientWidth; height = stage.clientHeight; });
    observer.observe(stage);
    const tick = (now: number) => {
      const dt = Math.min(now - (last || now), 32); last = now;
      const r = rotation.current;
      if (!r.drag) {
        if (!reduced.matches && !r.hover) r.y += dt * .000055;
        r.y += r.vy; r.x += r.vx; r.vx *= .94; r.vy *= .94;
      }
      r.x = Math.max(-.8, Math.min(.8, r.x));
      const sink = r.leaving ? easeInOut(Math.min(1, (now - r.leaving) / 650)) : 0;
      const radius = Math.min(width * .33, height * .31, 315) * (1 - sink * .3);
      const mobile = width < 700;
      const arrive = arrival.current;
      items.forEach((_, i) => {
        const node = cardsRef.current[i];
        if (!node) return;
        const py = 1 - 2 * (i + .5) / items.length;
        const spread = Math.sqrt(1 - py * py);
        const angle = i * 2.39996323 + r.y;
        const px = Math.cos(angle) * spread;
        const pz = Math.sin(angle) * spread;
        const y = py * Math.cos(r.x) - pz * Math.sin(r.x);
        const z = py * Math.sin(r.x) + pz * Math.cos(r.x);
        const depth = .76 + (z + 1) * .19;
        let w = (mobile ? 48 : 69) * depth, tx = px * radius, ty = y * radius;
        const start = arrive?.from[i];
        if (arrive && start) {
          const p = easeInOut(Math.max(0, Math.min(1, (now - arrive.start - Math.min(i * 14, 260)) / 1150)));
          tx = start.x + (tx - start.x) * p; ty = start.y + (ty - start.y) * p; w = start.w + (w - start.w) * p;
        }
        node.style.width = w + 'px';
        node.style.transform = 'translate(-50%, -50%) translate3d(' + tx + 'px,' + ty + 'px,0)';
        node.style.zIndex = String(Math.round((z + 1) * 50));
        // Cards turning onto the far side of the orb soften as if seen through frosted glass.
        const back = r.leaving ? 0 : Math.max(0, Math.min(1, (-z - .05) / .75));
        node.style.filter = back > .01 ? 'blur(' + (back * 3.5).toFixed(2) + 'px)' : '';
        node.style.opacity = r.leaving ? '' : String(1 - back * .18);
      });
      if (arrive && now - arrive.start > 1500) arrival.current = null;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      rotation.current.y += Math.max(-100, Math.min(100, event.deltaY + event.deltaX)) * .003;
    };
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); stage.removeEventListener('wheel', wheel); };
  }, [items]);

  // The orb draws in and sinks away with the clicked card last to fade; the project surfaces from behind.
  const openProject = (event: React.MouseEvent<HTMLAnchorElement>, to: string) => {
    const r = rotation.current;
    if (r.moved) { event.preventDefault(); return; }
    if (r.leaving) { event.preventDefault(); return; }
    const scene = stageRef.current?.parentElement;
    if (!scene || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0 || prefersReducedMotion()) return;
    event.preventDefault();
    r.leaving = performance.now(); r.hover = true;
    event.currentTarget.classList.add('is-picked');
    stageRef.current?.classList.add('is-leaving');
    const card = event.currentTarget.getBoundingClientRect();
    recedeIntoProject(scene, { x: card.left + card.width / 2, y: card.top + card.height / 2 }, () => navigate(to));
  };

  return (
    <SiteShell active="space">
      <main className="creative-space">
        <h1 className="sr-only">Lee Jae Woong — Creative Space</h1>
        <div className="space-stage" ref={stageRef} aria-label="Interactive project gallery"
          onPointerDown={event => {
            if (event.button !== 0) return;
            const r = rotation.current; r.drag = true; r.moved = false; r.distance = 0; r.px = event.clientX; r.py = event.clientY; r.vx = 0; r.vy = 0;
          }}
          onPointerMove={event => {
            const r = rotation.current;
            if (!r.drag) return;
            const dx = event.clientX - r.px, dy = event.clientY - r.py;
            r.distance += Math.abs(dx) + Math.abs(dy);
            if (r.distance > 6) r.moved = true;
            r.vy = dx * .006; r.vx = dy * .003;
            r.y += r.vy; r.x += r.vx; r.px = event.clientX; r.py = event.clientY;
          }}
          onPointerUp={() => { rotation.current.drag = false; }}
          onPointerCancel={() => { rotation.current.drag = false; }}
          onPointerLeave={() => { rotation.current.drag = false; if (!rotation.current.leaving) rotation.current.hover = false; }}
        >
          {items.map((item, index) => {
            const to = '/project/' + item.project.category + '/' + item.project.id;
            return (
              <Link key={item.project.id + '-' + item.image} className="space-card"
                to={to}
                ref={node => { cardsRef.current[index] = node; }}
                style={{ '--entry-delay': Math.min(index * 24, 380) + 'ms' } as React.CSSProperties}
                aria-label={'Open ' + item.project.title}
                onMouseEnter={() => { rotation.current.hover = true; }}
                onMouseLeave={() => { if (!rotation.current.leaving) rotation.current.hover = false; }}
                onFocus={() => { rotation.current.hover = true; }}
                onBlur={() => { if (!rotation.current.leaving) rotation.current.hover = false; }}
                onClick={event => openProject(event, to)}
              >
                <img src={imageUrl(item.image, 300)} alt="" draggable={false} />
                <span className="card-frame" aria-hidden="true" />
                <span className="card-tab" aria-hidden="true" />
                <span className="space-card-label"><span className="card-number">{String(projects.indexOf(item.project) + 1).padStart(2, '0')}</span>{item.project.title}</span>
              </Link>
            );
          })}
        </div>
      </main>
    </SiteShell>
  );
}
