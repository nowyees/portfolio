import React, { useEffect, useRef, useState } from 'react';
import type { ProjectStory as Story, StoryImage, StoryRow, StorySection } from '../../lib/projectStories';

type Film = { url: string; poster?: string };

// A project told from its portfolio slides, in chapters (overview, then the story's chapters, then its films). Each
// chapter opens with its name; within it, each part's title and text come first and its images follow. An index
// beside the page (a line at the top on phones) shows which chapter is being read and jumps between them.
// As the page scrolls, text rises into place, images open out of a slightly inset frame while settling from a small
// zoom, and the larger images drift a little against the scroll.
export default function ProjectStory({ story, title, films = [] }: { story: Story; title: string; films?: Film[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const chapters = story.sections.reduce<Array<{ name: string; sections: StorySection[] }>>((list, section) => {
    const last = list[list.length - 1];
    if (last && last.name === section.chapter) last.sections.push(section); else list.push({ name: section.chapter, sections: [section] });
    return list;
  }, []);
  const index = ['Overview', ...chapters.map(c => c.name), ...(films.length ? ['Film'] : [])];
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const root = rootRef.current!;
    // The chapter crossing the middle of the screen is the one being read.
    const parts = Array.from(root.querySelectorAll<HTMLElement>('.story-chapter'));
    const reading = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) setCurrent(parts.indexOf(entry.target as HTMLElement));
    }), { rootMargin: '-45% 0px -54% 0px' });
    parts.forEach(el => reading.observe(el));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shown = root.querySelectorAll<HTMLElement>('.story-rv, .story-media');
    if (reduce) { shown.forEach(el => el.classList.add('is-in')); return () => reading.disconnect(); }
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
    return () => { reading.disconnect(); io.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('scroll', request); window.removeEventListener('resize', request); };
  }, [story, films.length]);

  const jump = (i: number) => {
    const target = rootRef.current?.querySelectorAll<HTMLElement>('.story-chapter')[i];
    if (!target) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 70, behavior: reduce ? 'auto' : 'smooth' });
  };
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
  // A row of images at one height. Only a lone landscape image drifts; long strips (drawings, blueprints) keep their
  // edges. On phones a row stays one line unless it is long (a wide image beside others): then the first image takes
  // a line of its own and the rest share the next.
  const row = (r: StoryRow, label: string, k: number) => (
    <div className={`story-row is-${r.align || 'start'}${r.images.length > 1 && r.images.reduce((sum, image) => sum + image.w / image.h, 0) > 2.4 ? ' is-long' : ''}`} key={k} style={r.width ? { width: `${r.width * 100}%` } : undefined}>
      {r.images.map((image, i) => figure(image, `${title} — ${label}`, i * .12, r.images.length === 1 && image.w / image.h > 1.2 && image.w / image.h < 3 ? .04 : 0))}
    </div>
  );
  const head = (i: number, name: string) => (
    <header className="story-chapter-head">
      <p className="story-rv"><span>{String(i).padStart(2, '0')}</span>{story.kickers?.[name]}</p>
      <h2 className="story-rv" style={{ transitionDelay: '.08s' }}>{name}</h2>
    </header>
  );

  return (
    <div className="story" ref={rootRef}>
      <nav className="story-index" aria-label={`${title} chapters`}>
        <p className="story-now" aria-hidden="true"><span>{String(current).padStart(2, '0')}</span>{index[current]}</p>
        <ol>
          {index.map((name, i) => <li key={name}>
            <button type="button" className={i === current ? 'is-current' : undefined} aria-current={i === current ? 'true' : undefined} onClick={() => jump(i)}>
              <span>{String(i).padStart(2, '0')}</span>{name}
            </button>
          </li>)}
        </ol>
      </nav>
      <div className="story-body">
        <section className="story-chapter is-overview" aria-label="Overview">
          <div className="story-hero">{figure(story.hero, title, 0, .06)}</div>
          <div className="story-intro">
            <div className="story-intro-text">
              <p className="story-lead story-rv">{story.intro.ko}</p>
              {story.intro.en && <p className="story-lead-en story-rv" style={{ transitionDelay: '.12s' }}>{story.intro.en}</p>}
            </div>
            <dl className="story-facts">
              {story.facts.map(([term, value], i) => <div className="story-rv" style={{ transitionDelay: `${i * .08}s` }} key={term}><dt>{term}</dt><dd>{value}</dd></div>)}
            </dl>
            {story.intro.image && <div className="story-intro-image">{figure(story.intro.image, title, 0, .05)}</div>}
          </div>
        </section>
        {chapters.map((chapter, c) => (
          <section className="story-chapter" key={chapter.name} aria-label={chapter.name}>
            {head(c + 1, chapter.name)}
            {chapter.sections.map(section => (
              <div className="story-section" key={section.texts[0].title}>
                <div className={`story-texts has-${section.texts.length}`}>
                  {section.texts.map((text, i) => (
                    <div className="story-text" key={text.title}>
                      {/* a part named as its chapter (Tail Device in Tail Device) needs no second title */}
                      {text.title.toLowerCase() !== chapter.name.toLowerCase() && <h3 className="story-rv" style={{ transitionDelay: `${i * .1}s` }}>{text.num && <span>{text.num}</span>}{text.title}</h3>}
                      <p className="story-rv" style={{ transitionDelay: `${i * .1 + .1}s` }}>{text.body}</p>
                    </div>
                  ))}
                </div>
                <div className="story-rows">{section.rows.map((r, k) => row(r, section.texts[0].title, k))}</div>
              </div>
            ))}
          </section>
        ))}
        {films.length > 0 && <section className="story-chapter is-films" aria-label="Film">
          {head(chapters.length + 1, 'Film')}
          <div className="story-films">
            {films.map((film, i) => <video key={film.url} src={film.url} poster={film.poster} controls muted playsInline preload="metadata" aria-label={`${title} film ${i + 1}`} />)}
          </div>
        </section>}
      </div>
    </div>
  );
}
