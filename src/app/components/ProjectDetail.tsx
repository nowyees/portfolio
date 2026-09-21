import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import SiteShell from './SiteShell';
import { usePortfolio, imageUrl } from '../../lib/usePortfolio';
import { isVideoUrl } from '../../lib/storageService';

export default function ProjectDetail() {
  const { category, id } = useParams();
  const projects = usePortfolio();
  const project = projects.find(p => String(p.id) === id && p.category === category);
  const galleryRef = useRef<HTMLElement>(null);
  const dragRef = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });
  useEffect(() => { window.scrollTo(0, 0); }, [id, category]);
  useLayoutEffect(() => {
    if (project?.detailLayout !== 'gallery') return;
    const gallery = galleryRef.current;
    if (!gallery) return;
    let frame = 0;
    const centerFirst = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const first = gallery.querySelector<HTMLElement>('.detail-media-item');
        if (!first || !first.offsetWidth) return;
        gallery.scrollLeft = first.offsetLeft - (gallery.clientWidth - first.offsetWidth) * .5;
      });
    };
    centerFirst();
    const firstMedia = gallery.querySelector<HTMLImageElement | HTMLVideoElement>('.detail-media-item img, .detail-media-item video');
    firstMedia?.addEventListener(firstMedia instanceof HTMLVideoElement ? 'loadedmetadata' : 'load', centerFirst);
    const observer = new ResizeObserver(centerFirst);
    observer.observe(gallery);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      firstMedia?.removeEventListener(firstMedia instanceof HTMLVideoElement ? 'loadedmetadata' : 'load', centerFirst);
    };
  }, [project?.id, project?.detailLayout, project?.media?.length]);
  if (!project) return <SiteShell active="projects"><main className="missing-project"><h1>Project not found.</h1><Link to="/projects">All projects ↗</Link></main></SiteShell>;
  const media = project.media?.length ? project.media : [{ url: project.image, type: 'image' as const, layout: 'full' as const }];
  const detailLayout = project.detailLayout || 'padded';
  const moveGallery = (direction: -1 | 1) => {
    const gallery = galleryRef.current;
    if (!gallery) return;
    const slides = Array.from(gallery.querySelectorAll<HTMLElement>('.detail-media-item'));
    if (!slides.length) return;
    const galleryCenter = gallery.getBoundingClientRect().left + gallery.clientWidth * .5;
    const currentIndex = slides.reduce((closest, slide, index) => {
      const center = slide.getBoundingClientRect().left + slide.offsetWidth * .5;
      const closestCenter = slides[closest].getBoundingClientRect().left + slides[closest].offsetWidth * .5;
      return Math.abs(center - galleryCenter) < Math.abs(closestCenter - galleryCenter) ? index : closest;
    }, 0);
    const nextIndex = (currentIndex + direction + slides.length) % slides.length;
    slides[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };
  const clickGallery = (event: React.MouseEvent<HTMLElement>) => {
    if (detailLayout !== 'gallery') return;
    if (dragRef.current.moved) { event.preventDefault(); dragRef.current.moved = false; return; }
    const video = (event.target as HTMLElement).closest('video');
    if (video && event.clientY > video.getBoundingClientRect().bottom - 64) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    moveGallery(event.clientX < rect.left + rect.width * .5 ? -1 : 1);
  };
  const next = projects[(projects.indexOf(project) + 1) % projects.length];
  const renderMedia = (items: typeof media, startIndex = 0) => items.map((item, index) => {
    const mediaIndex = startIndex + index;
    return <div className={'detail-media-item is-' + (item.layout || 'full')} key={item.url + mediaIndex}>
      {item.type === 'video' || isVideoUrl(item.url)
        ? <video src={item.url} poster={item.thumbnailUrl} controls muted playsInline preload="metadata" aria-label={project.title + ' film ' + (mediaIndex + 1)} />
        : <img src={imageUrl(item.url, 2000)} alt={project.title + ' — ' + (mediaIndex + 1)} loading={mediaIndex === 0 ? 'eager' : 'lazy'} draggable={detailLayout !== 'gallery'} />}
    </div>;
  });
  return (
    <SiteShell active="projects">
      <main className="project-detail">
        <header className={'detail-intro ' + (detailLayout === 'gallery' ? 'is-gallery' : '')}>
          <h1>{project.title}</h1>
          <p className="detail-year">{project.year}</p>
          {detailLayout !== 'gallery' && <>
            <p className="detail-description">{project.desc}</p>
            {project.showExternalLink && project.externalLink && <a className="detail-external-link" href={project.externalLink} target="_blank" rel="noopener noreferrer">View publication ↗</a>}
          </>}
        </header>
        <section
          ref={galleryRef}
          className={'detail-media is-' + detailLayout}
          aria-label={project.title + (detailLayout === 'gallery' ? ' gallery. Click the left or right half to browse.' : ' images and films')}
          tabIndex={detailLayout === 'gallery' ? 0 : undefined}
          onClick={clickGallery}
          onPointerDown={event => {
            if (detailLayout !== 'gallery' || event.button !== 0 || event.pointerType !== 'mouse') return;
            const video = (event.target as HTMLElement).closest('video');
            if (video && event.clientY > video.getBoundingClientRect().bottom - 64) return;
            const gallery = event.currentTarget;
            dragRef.current = { active: true, moved: false, startX: event.clientX, scrollLeft: gallery.scrollLeft };
            gallery.setPointerCapture(event.pointerId);
            gallery.classList.add('is-dragging');
          }}
          onPointerMove={event => {
            if (!dragRef.current.active) return;
            const distance = event.clientX - dragRef.current.startX;
            if (Math.abs(distance) > 5) dragRef.current.moved = true;
            event.currentTarget.scrollLeft = dragRef.current.scrollLeft - distance;
            if (dragRef.current.moved) event.preventDefault();
          }}
          onPointerUp={event => {
            if (!dragRef.current.active) return;
            dragRef.current.active = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
            event.currentTarget.classList.remove('is-dragging');
          }}
          onPointerCancel={event => {
            dragRef.current.active = false;
            dragRef.current.moved = false;
            event.currentTarget.classList.remove('is-dragging');
          }}
          onKeyDown={event => {
            if (detailLayout === 'gallery' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
              event.preventDefault(); moveGallery(event.key === 'ArrowLeft' ? -1 : 1);
            }
          }}
        >
          {renderMedia(media)}
        </section>
        {detailLayout === 'gallery' && <section className="detail-summary" aria-label="Project description">
          <p className="detail-description">{project.desc}</p>
          {project.showExternalLink && project.externalLink && <a className="detail-external-link" href={project.externalLink} target="_blank" rel="noopener noreferrer">View publication ↗</a>}
        </section>}
        <footer className="detail-footer">
          <Link to="/projects">All projects</Link>
          {next && <Link to={'/project/' + next.category + '/' + next.id}>Next Project<br /><em>{next.title} ↗</em></Link>}
        </footer>
      </main>
    </SiteShell>
  );
}

