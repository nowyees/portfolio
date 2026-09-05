import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import SiteShell from './SiteShell';
import { usePortfolio, imageUrl } from '../../lib/usePortfolio';

export default function Home() {
  const projects = usePortfolio();
  const [selected, setSelected] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const rotation = useRef({ x: .12, y: .35, vx: 0, vy: 0, drag: false, moved: false, distance: 0, px: 0, py: 0, hover: false });
  const items = useMemo(() => {
    const thumbs = projects.filter(p => p.image).map(project => ({ project, image: project.image }));
    const extras = projects.flatMap(project => {
      const media = project.media?.find(m => m.type === 'image' && m.url !== project.image);
      return media ? [{ project, image: media.url }] : [];
    }).slice(0, 7);
    return [...thumbs, ...extras];
  }, [projects]);
  const selectedItem = selected === null ? null : items[selected];

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
      if (!r.drag && selected === null) {
        if (!reduced.matches && !r.hover) r.y += dt * .000055;
        r.y += r.vy; r.x += r.vx; r.vx *= .94; r.vy *= .94;
      }
      r.x = Math.max(-.8, Math.min(.8, r.x));
      const radius = Math.min(width * .33, height * .31, 315);
      const mobile = width < 700;
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
        const w = (mobile ? 48 : 69) * depth;
        node.style.width = w + 'px';
        node.style.transform = 'translate(-50%, -50%) translate3d(' + (px * radius) + 'px,' + (y * radius) + 'px,0)';
        node.style.zIndex = String(Math.round((z + 1) * 50));
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const wheel = (event: WheelEvent) => {
      if (selected !== null) return;
      event.preventDefault();
      rotation.current.y += Math.max(-100, Math.min(100, event.deltaY + event.deltaX)) * .003;
    };
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); stage.removeEventListener('wheel', wheel); };
  }, [items, selected]);

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
          onPointerLeave={() => { rotation.current.drag = false; rotation.current.hover = false; }}
        >
          {items.map((item, index) => (
            <button key={item.project.id + '-' + item.image} className="space-card"
              ref={node => { cardsRef.current[index] = node; }}
              style={{ '--entry-delay': Math.min(index * 24, 380) + 'ms' } as React.CSSProperties}
              type="button" aria-label={'View ' + item.project.title}
              onMouseEnter={() => { rotation.current.hover = true; }}
              onMouseLeave={() => { rotation.current.hover = false; }}
              onFocus={() => { rotation.current.hover = true; }}
              onBlur={() => { rotation.current.hover = false; }}
              onClick={event => { if (event.detail === 0 || !rotation.current.moved) setSelected(index); }}
            >
              <img src={imageUrl(item.image, 300)} alt="" draggable={false} />
              <span className="space-card-label">{item.project.title}</span>
            </button>
          ))}
        </div>
        <Dialog.Root open={selectedItem !== null} onOpenChange={open => { if (!open) setSelected(null); }}>
          <Dialog.Portal>
            <Dialog.Overlay className="space-overlay" />
            <Dialog.Content className="space-selection" aria-describedby={undefined}
              onKeyDown={event => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  setSelected(current => current === null ? null : (current + (event.key === 'ArrowLeft' ? -1 : 1) + items.length) % items.length);
                }
              }}>
              <Dialog.Close className="space-close">Close</Dialog.Close>
              {selectedItem && <>
                <Link to={'/project/' + selectedItem.project.category + '/' + selectedItem.project.id} className="space-selected-image" aria-label={'View case: ' + selectedItem.project.title}>
                  <img src={imageUrl(selectedItem.image, 1000)} alt={selectedItem.project.title} />
                  <span>View Case ↗</span>
                </Link>
                <div className="space-selection-caption">
                  <Dialog.Title>{selectedItem.project.title}</Dialog.Title>
                  <p>{selectedItem.project.hashtags?.join(', ') || selectedItem.project.year}</p>
                </div>
                <button className="space-previous" aria-label="Previous image" onClick={() => setSelected(((selected ?? 0) - 1 + items.length) % items.length)}>←</button>
                <button className="space-next" aria-label="Next image" onClick={() => setSelected(((selected ?? 0) + 1) % items.length)}>→</button>
              </>}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </main>
    </SiteShell>
  );
}
