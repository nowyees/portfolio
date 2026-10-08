import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router';
import { usePortfolio, imageUrl } from '../../lib/usePortfolio';
import { holdPageEnter, makeClone, projectKey, saveGrid, snapshotItem, takeOrb, type SnapshotItem } from '../../lib/orbTransition';
import SiteShell from './SiteShell';

const px = (r: { left: number; top: number; width: number; height: number }) => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });

export default function Projects() {
  const projects = usePortfolio();
  const mainRef = useRef<HTMLElement>(null);
  const pendingOrb = useRef<SnapshotItem[] | null | undefined>(undefined);
  const clones = useRef<HTMLElement[]>([]);

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
      if (!main) return;
      saveGrid(Array.from(main.querySelectorAll<HTMLElement>('.project-tile-image')).flatMap(tile => {
        const r = tile.getBoundingClientRect();
        return r.bottom > -100 && r.top < window.innerHeight + 100 ? [snapshotItem(tile.dataset.key!, tile.dataset.image!, tile)] : [];
      }));
    };
  }, []);

  return (
    <SiteShell active="projects">
      <main className="projects-page" ref={mainRef}>
        <h1 className="gallery-intro"><span>A Curated Selection of</span> <em>Objects and Visual Experiences</em></h1>
        <section className="project-grid" aria-label="Selected projects">
          {projects.map(project => (
            <article className="project-tile" key={project.category + '-' + project.id}>
              <Link className="project-tile-image" to={'/project/' + project.category + '/' + project.id} aria-label={'View ' + project.title}
                data-key={projectKey(project)} data-image={project.image}>
                <img src={imageUrl(project.image, 1000)} alt={project.title} loading="lazy" />
                <span className="project-view">View ↗︎</span>
              </Link>
              <h2><Link to={'/project/' + project.category + '/' + project.id}>{project.title}</Link></h2>
              <p>{project.hashtags?.join(', ') || project.year}</p>
            </article>
          ))}
        </section>
        <footer className="gallery-footer"><Link to="/about">Lee Jae Woong</Link><Link to="/about#contact">Contact ↗︎</Link></footer>
      </main>
    </SiteShell>
  );
}
