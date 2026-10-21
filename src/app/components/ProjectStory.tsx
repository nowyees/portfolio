import React, { useEffect, useRef } from 'react';
import type { ProjectStory as Story, StoryImage, StoryRow } from '../../lib/projectStories';

// A project told section by section from its portfolio slides: each section's title and text, then its images in
// rows. As the page scrolls, text rises into place, images open out of a slightly inset frame while settling from
// a small zoom, and the larger images drift a little against the scroll.
export default function ProjectStory({ story, title }: { story: Story; title: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shown = root.querySelectorAll<HTMLElement>('.story-rv, .story-media');
    if (reduce || !('IntersectionObserver' in window)) { shown.forEach(el => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
    }), { rootMargin: '0px 0px -12% 0px', threshold: .01 });
    shown.forEach(el => io.observe(el));
    // Drift: each image's inner layer moves against the scroll by a share of its distance from the screen's middle.
    const drifting = Array.from(root.querySelectorAll<HTMLElement>('[data-drift]'));
    let frame = 0;
    const place = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      for (const el of drifting) {
        const box = el.parentElement!.getBoundingClientRect();
        if (box.bottom < -200 || box.top > window.innerHeight + 200) continue;
        el.style.transform = `translate3d(0,${((box.top + box.height / 2 - middle) * -Number(el.dataset.drift)).toFixed(1)}px,0)`;
      }
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(place); };
    window.addEventListener('scroll', request, { passive: true }); window.addEventListener('resize', request); place();
    return () => { io.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('scroll', request); window.removeEventListener('resize', request); };
  }, [story]);

  const figure = (image: StoryImage, alt: string, delay = 0, drift = 0) => (
    <figure className="story-figure" style={{ flex: `${image.w / image.h} 1 0` }} key={image.src}>
      <div className="story-media" style={{ aspectRatio: `${image.w} / ${image.h}`, transitionDelay: `${delay}s` }}>
        <div className="story-drift" data-drift={drift || undefined}>
          <img src={image.src} alt={alt} width={image.w} height={image.h} loading="lazy" decoding="async" style={{ transitionDelay: `${delay}s` }} />
        </div>
      </div>
      {image.caption && <figcaption className="story-rv" style={{ transitionDelay: `${delay + .2}s` }}>{image.caption}</figcaption>}
    </figure>
  );
  // Only a lone landscape image drifts; long strips (drawings, blueprints) keep their edges.
  const row = (r: StoryRow, label: string, k: number) => (
    // On phones a row stays one line unless it is long (a wide image beside others): then the first image takes a
    // line of its own and the rest share the next.
    <div className={`story-row is-${r.align || 'start'}${r.images.length > 1 && r.images.reduce((sum, image) => sum + image.w / image.h, 0) > 2.4 ? ' is-long' : ''}`} key={k} style={r.width ? { width: `${r.width * 100}%` } : undefined}>
      {r.images.map((image, i) => figure(image, `${title} — ${label}`, i * .12, r.images.length === 1 && image.w / image.h > 1.2 && image.w / image.h < 3 ? .04 : 0))}
    </div>
  );

  return (
    <div className="story" ref={rootRef}>
      <section className="story-hero">
        {figure(story.hero, title, 0, .06)}
      </section>
      <section className="story-intro">
        <dl className="story-facts">
          {story.facts.map(([term, value], i) => <div className="story-rv" style={{ transitionDelay: `${i * .08}s` }} key={term}><dt>{term}</dt><dd>{value}</dd></div>)}
        </dl>
        <div className="story-intro-text">
          <p className="story-lead story-rv">{story.intro.ko}</p>
          {story.intro.en && <p className="story-lead-en story-rv" style={{ transitionDelay: '.12s' }}>{story.intro.en}</p>}
        </div>
        {story.intro.image && <div className="story-intro-image">{figure(story.intro.image, title, 0, .05)}</div>}
      </section>
      {story.sections.map(section => (
        <section className="story-section" key={section.num}>
          <div className={`story-texts has-${section.texts.length}`}>
            {section.texts.map((text, i) => (
              <div className="story-text" key={text.title}>
                <h2 className="story-rv" style={{ transitionDelay: `${i * .1}s` }}>{text.num && <span>{text.num}</span>}{text.title}</h2>
                <p className="story-rv" style={{ transitionDelay: `${i * .1 + .1}s` }}>{text.body}</p>
              </div>
            ))}
          </div>
          <div className="story-rows">{section.rows.map((r, k) => row(r, section.texts[0]?.title || section.label, k))}</div>
        </section>
      ))}
    </div>
  );
}
