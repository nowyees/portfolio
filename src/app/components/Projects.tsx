import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { usePortfolio, imageUrl } from '../../lib/usePortfolio';
import { holdPageEnter, makeClone, prefersReducedMotion, projectKey, recedeIntoProject, saveGrid, snapshotItem, takeOrb, type SnapshotItem } from '../../lib/orbTransition';
import SiteShell from './SiteShell';

const px = (r: { left: number; top: number; width: number; height: number }) => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
const pad = (n: number) => String(n).padStart(2, '0');

export default function Projects() {
  const projects = usePortfolio();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const pendingOrb = useRef<SnapshotItem[] | null | undefined>(undefined);
  const clones = useRef<HTMLElement[]>([]);
  const leaving = useRef(false);

  // Coming from Space: the orb's cards fly out and settle into their tiles.
  useLayoutEffect(() => {
    if (pendingOrb.current === undefined) pendingOrb.current = takeOrb();
    const cards = pendingOrb.current, main = mainRef.current;
    if (!cards || !main || !projects.length) return;
    pendingOrb.current = null;
    holdPageEnter();
    main.classList.add('is-morph-in');
    const used = new Set<number>();
    const tiles = Array.from(main.querySelectorAll<HTMLElement>('.project-tile-image'));
    tiles.forEach((tile, i) => {
      const { key, image } = tile.dataset;
      let index = cards.findIndex((card, j) => !used.has(j) && card.key === key && card.image === image);
      if (index < 0) index = cards.findIndex((card, j) => !used.has(j) && card.key === key);
      if (index < 0) { tile.classList.add('is-landed'); return; }
      used.add(index);
      const clone = makeClone(imageUrl(cards[index].image, 300), cards[index].rect);
      clones.current.push(clone);
      const flight = clone.animate([px(cards[index].rect), px(tile.getBoundingClientRect())],
        { duration: 1100, delay: Math.min(i * 28, 340), easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
      flight.onfinish = () => {
        tile.classList.add('is-landed');
        clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' }).onfinish = () => clone.remove();
      };
    });
    // Extra orb cards with no tile of their own dissolve where they were.
    cards.forEach((card, j) => {
      if (used.has(j)) return;
      const clone = makeClone(imageUrl(card.image, 300), card.rect);
      clones.current.push(clone);
      clone.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 600, easing: 'ease', fill: 'forwards' }).onfinish = () => clone.remove();
    });
  }, [projects]);

  useEffect(() => () => { clones.current.forEach(clone => clone.remove()); }, []);

  // Leaving Projects: remember the visible tiles so Space can pull them back into the orb.
  useLayoutEffect(() => {
    const main = mainRef.current;
    return () => {
      if (!main || leaving.current) return;
      saveGrid(Array.from(main.querySelectorAll<HTMLElement>('.project-tile-image')).flatMap(tile => {
        const r = tile.getBoundingClientRect();
        return r.bottom > -100 && r.top < window.innerHeight + 100 ? [snapshotItem(tile.dataset.key!, tile.dataset.image!, tile)] : [];
      }));
    };
  }, []);

  // Same exit as Space: the index sinks into the clicked work and the project surfaces from depth.
  const openProject = (event: React.MouseEvent<HTMLAnchorElement>, to: string) => {
    const main = mainRef.current;
    if (leaving.current) { event.preventDefault(); return; }
    if (!main || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0 || prefersReducedMotion()) return;
    event.preventDefault();
    leaving.current = true;
    const tile = event.currentTarget.closest('.project-tile');
    tile?.classList.add('is-picked');
    main.classList.add('is-leaving');
    const r = (tile?.querySelector('.project-tile-image') ?? event.currentTarget).getBoundingClientRect();
    recedeIntoProject(main, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, () => navigate(to));
  };

  return (
    <SiteShell active="projects">
      <main className="projects-page projects-index" ref={mainRef}>
        <div className="projects-columns" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}
        </div>
        <h1 className="gallery-intro"><span>A Curated Selection of</span> <em>Objects and Visual Experiences</em></h1>
        <p className="projects-count">Index — {pad(projects.length)} works</p>
        <section className="project-grid" aria-label="Selected projects">
          {projects.map((project, index) => {
            const to = '/project/' + project.category + '/' + project.id;
            return (
              <article className="project-tile" key={project.category + '-' + project.id}>
                <Link className="project-tile-image" to={to} aria-label={'View ' + project.title}
                  data-key={projectKey(project)} data-image={project.image} onClick={event => openProject(event, to)}>
                  <img src={imageUrl(project.image, 500)} alt={project.title} loading="lazy" />
                </Link>
                <span className="project-index">{pad(index + 1)}</span>
                <h2><Link to={to} onClick={event => openProject(event, to)}>{project.title}</Link></h2>
                <p>{project.hashtags?.join(', ') || project.year}</p>
              </article>
            );
          })}
        </section>
        <footer className="gallery-footer"><Link to="/about">Lee Jae Woong</Link><Link to="/about#contact">Contact ↗︎</Link></footer>
      </main>
    </SiteShell>
  );
}
