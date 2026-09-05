import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import SiteShell from './SiteShell';
import { usePortfolio, imageUrl } from '../../lib/usePortfolio';
import { isVideoUrl } from '../../lib/storageService';

export default function ProjectDetail() {
  const { category, id } = useParams();
  const projects = usePortfolio();
  const project = projects.find(p => String(p.id) === id && p.category === category);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  useEffect(() => { window.scrollTo(0, 0); setInfoOpen(false); }, [id, category]);
  useEffect(() => {
    if (!infoOpen) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setInfoOpen(false); };
    const outside = (e: PointerEvent) => { if (!infoRef.current?.contains(e.target as Node)) setInfoOpen(false); };
    window.addEventListener('keydown', close); window.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('pointerdown', outside); };
  }, [infoOpen]);
  if (!project) return <SiteShell active="projects"><main className="missing-project"><h1>Project not found.</h1><Link to="/projects">All projects ↗</Link></main></SiteShell>;
  const media = project.media?.length ? project.media : [{ url: project.image, type: 'image' as const, layout: 'full' as const }];
  const next = projects[(projects.indexOf(project) + 1) % projects.length];
  return (
    <SiteShell active="projects">
      <main className="project-detail">
        <div ref={infoRef} className={'project-info ' + (infoOpen ? 'is-open' : '')}>
          <button type="button" onClick={() => setInfoOpen(value => !value)} aria-expanded={infoOpen} aria-controls="project-information">{infoOpen ? 'Close' : 'Project Info'}</button>
          {infoOpen && <div className="project-info-content" id="project-information">
            <h2>{project.title}</h2><p className="info-tags">{project.hashtags?.join(', ') || project.year}</p>
            <p className="info-description">{project.desc}</p>
            <dl><dt>Year</dt><dd>{project.year}</dd></dl>
            {project.showExternalLink && project.externalLink && <a href={project.externalLink} target="_blank" rel="noopener noreferrer">View publication ↗</a>}
          </div>}
        </div>
        <header className="detail-intro"><h1>{project.title}</h1><p>{project.hashtags?.join(', ') || project.year}</p></header>
        <section className="detail-media" aria-label={project.title + ' images and films'}>
          {media.map((item, i) => <div className={'detail-media-item ' + (item.layout === 'half' ? 'is-half' : '')} key={item.url + i}>
            {item.type === 'video' || isVideoUrl(item.url)
              ? <video src={item.url} poster={item.thumbnailUrl} controls muted playsInline preload="metadata" aria-label={project.title + ' film ' + (i + 1)} />
              : <img src={imageUrl(item.url, 2000)} alt={project.title + ' — ' + (i + 1)} loading={i === 0 ? 'eager' : 'lazy'} />}
          </div>)}
        </section>
        <footer className="detail-footer">
          <Link to="/projects">All projects</Link>
          {next && <Link to={'/project/' + next.category + '/' + next.id}>Next Project<br /><em>{next.title} ↗</em></Link>}
        </footer>
      </main>
    </SiteShell>
  );
}
