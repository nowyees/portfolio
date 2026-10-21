import React, { useEffect, useRef, useState } from 'react';
import type { ProjectStory as Story, StoryImage, StoryRow, StorySection, StoryText } from '../../lib/projectStories';

type Film = { url: string; poster?: string };

// The page runs on twelve columns: the chapter index sits in the first two and everything else lines up on the
// right ten — text on six of them (3–8), facts on the last three (10–12), images on any run of the ten, or across
// the whole page.
const CONTENT_START = 3, CONTENT_END = 13;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = (n: number) => String(n).padStart(2, '0');

// An image that opens out of a slightly inset frame while settling from a small zoom as it scrolls in; with
// `drift`, its inner layer also moves a little against the scroll.
function Figure({ image, alt, delay = 0, drift = 0, style }: { image: StoryImage; alt: string; delay?: number; drift?: number; style?: React.CSSProperties }) {
  return <figure className="story-figure" style={{ flex: `${image.w / image.h} 1 0`, ...style }}>
    <div className="story-media" style={{ aspectRatio: `${image.w} / ${image.h}`, transitionDelay: `${delay}s` }}>
      <div className="story-drift" data-drift={drift || undefined}>
        <img src={image.src} alt={alt} width={image.w} height={image.h} loading="lazy" decoding="async" style={{ transitionDelay: `${delay}s` }} />
      </div>
    </div>
    {image.caption && <figcaption className="story-rv" style={{ transitionDelay: `${delay + .2}s` }}>{image.caption}</figcaption>}
  </figure>;
}

// A row of images at one height, over its run of the content columns. Only a lone landscape image drifts; long
// strips (drawings, blueprints) keep their edges. On phones a long row (a wide image beside others) breaks after
// its first image.
function Row({ row, alt }: { row: StoryRow; alt: string }) {
  const span = row.span || CONTENT_END - CONTENT_START, start = row.align === 'end' ? CONTENT_END - span : CONTENT_START;
  const ratio = row.images.reduce((sum, image) => sum + image.w / image.h, 0);
  return <div className={'story-row' + (row.images.length > 1 && ratio > 2.4 ? ' is-long' : '')} style={{ gridColumn: `${start} / ${start + span}` }}>
    {row.images.map((image, i) => <Figure key={image.src} image={image} alt={alt} delay={i * .12} drift={row.images.length === 1 && ratio > 1.2 && ratio < 3 ? .04 : 0} />)}
  </div>;
}

// A part's title and text. A part named as its chapter (Tail Device in Tail Device) needs no second title.
function Copy({ text, chapter, delay = 0, style }: { text: StoryText; chapter: string; delay?: number; style?: React.CSSProperties }) {
  return <div className="story-copy" style={style}>
    {text.title.toLowerCase() !== chapter.toLowerCase() && <h3 className="story-rv" style={{ transitionDelay: `${delay}s` }}>{text.num && <span>{text.num}</span>}{text.title}</h3>}
    <p className="story-rv" style={{ transitionDelay: `${delay + .1}s` }}>{text.body}</p>
  </div>;
}

// Splits the ten content columns between `n` things side by side.
const columns = (n: number) => {
  const each = Math.floor((CONTENT_END - CONTENT_START) / n);
  return Array.from({ length: n }, (_, i) => `${CONTENT_START + i * each} / ${i === n - 1 ? CONTENT_END : CONTENT_START + (i + 1) * each}`);
};

// Pinned: the stage holds still while the steps beside it scroll past; the step crossing the middle of the screen
// brings its images onto the stage. (On phones each step simply shows its images under its text.)
function Pinned({ steps, chapter, title }: { steps: Extract<StorySection, { kind: 'pinned' }>['steps']; chapter: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const items = Array.from(ref.current!.querySelectorAll<HTMLElement>('.story-pin-step'));
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) setActive(items.indexOf(entry.target as HTMLElement));
    }), { rootMargin: '-48% 0px -48% 0px' });
    items.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
  return <div className="story-grid story-pin" ref={ref}>
    <div className="story-pin-stage" style={{ gridColumn: `${CONTENT_START} / 10` }}>
      <div className="story-pin-frame">
        {steps.map((step, i) => {
          const ratio = step.images.reduce((sum, image) => sum + image.w / image.h, 0);
          return <div key={step.text.title} className={'story-pin-layer' + (i === active ? ' is-active' : '')} aria-hidden={i !== active}>
            <div className="story-row" style={{ width: `min(100%, calc(var(--pin-h) * ${ratio.toFixed(3)}))` }}>
              {step.images.map(image => <figure className="story-figure" key={image.src} style={{ flex: `${image.w / image.h} 1 0` }}>
                <div className="story-media is-in" style={{ aspectRatio: `${image.w} / ${image.h}` }}><img src={image.src} alt={`${title} — ${step.text.title}`} width={image.w} height={image.h} loading="lazy" decoding="async" /></div>
              </figure>)}
            </div>
          </div>;
        })}
      </div>
    </div>
    <div className="story-pin-steps" style={{ gridColumn: `10 / ${CONTENT_END}` }}>
      {steps.map((step, i) => <div key={step.text.title} className={'story-pin-step' + (i === active ? ' is-active' : '')}>
        <Copy text={step.text} chapter={chapter} />
        <div className="story-row story-pin-inline">{step.images.map(image => <Figure key={image.src} image={image} alt={`${title} — ${step.text.title}`} />)}</div>
      </div>)}
    </div>
  </div>;
}

// Strip: the images sit in one long line that slides sideways while the page scrolls down past it. (On phones the
// line simply scrolls sideways under the finger.)
function Strip({ images, title }: { images: StoryImage[]; title: string }) {
  const outer = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const pinned = () => window.innerWidth > 900 && !reducedMotion();
    const size = () => {
      const travel = Math.max(0, track.current!.scrollWidth - window.innerWidth);
      outer.current!.style.height = pinned() ? `${window.innerHeight + travel}px` : '';
      place();
    };
    const place = () => {
      frame = 0;
      if (!pinned()) { track.current!.style.transform = ''; return; }
      const box = outer.current!.getBoundingClientRect(), travel = Math.max(0, track.current!.scrollWidth - window.innerWidth);
      const progress = Math.min(1, Math.max(0, -box.top / Math.max(1, box.height - window.innerHeight)));
      track.current!.style.transform = `translate3d(${(-progress * travel).toFixed(1)}px,0,0)`;
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(place); };
    window.addEventListener('scroll', request, { passive: true }); window.addEventListener('resize', size); size();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', request); window.removeEventListener('resize', size); };
  }, []);
  return <div className="story-strip" ref={outer}>
    <div className="story-strip-sticky">
      <div className="story-strip-track" ref={track}>
        {images.map((image, i) => <Figure key={image.src} image={image} alt={`${title} — ${i + 1}`} delay={i * .08} style={{ flex: 'none', width: `calc(var(--strip-h) * ${(image.w / image.h).toFixed(3)})` }} />)}
      </div>
    </div>
  </div>;
}

function Part({ section, title }: { section: StorySection; title: string }) {
  const chapter = section.chapter;
  switch (section.kind) {
    case 'feature': return <div className="story-part">
      {/* across the whole page when the image is large enough for it, else across the content columns */}
      <div className="story-grid"><div className="story-feature" style={{ gridColumn: section.image.w >= 1400 ? '1 / -1' : `${CONTENT_START} / ${CONTENT_END}` }}><Figure image={section.image} alt={`${title} — ${section.text.title}`} drift={.05} /></div></div>
      <div className="story-grid"><Copy text={section.text} chapter={chapter} style={{ gridColumn: `${CONTENT_START} / 9` }} /></div>
      {section.after && <div className="story-grid story-rows">{section.after.map((row, k) => <Row key={k} row={row} alt={`${title} — ${section.text.title}`} />)}</div>}
    </div>;
    case 'pinned': return <div className="story-part">
      <Pinned steps={section.steps} chapter={chapter} title={title} />
      {section.after && <div className="story-grid story-rows">{section.after.map((row, k) => <Row key={k} row={row} alt={title} />)}</div>}
    </div>;
    case 'compare': {
      const cols = columns(section.items.length);
      return <div className="story-part">
        {section.text && <div className="story-grid"><Copy text={section.text} chapter={chapter} style={{ gridColumn: `${CONTENT_START} / 9` }} /></div>}
        <div className="story-grid story-compare">
          {section.items.map((item, i) => <div key={item.text.title} className="story-compare-item" style={{ gridColumn: cols[i] }}>
            <Figure image={item.image} alt={`${title} — ${item.text.title}`} delay={i * .12} />
            <Copy text={item.text} chapter={chapter} delay={i * .12} />
          </div>)}
        </div>
      </div>;
    }
    case 'strip': return <div className="story-part">
      <div className="story-grid"><Copy text={section.text} chapter={chapter} style={{ gridColumn: `${CONTENT_START} / 9` }} /></div>
      <Strip images={section.images} title={title} />
    </div>;
    default: {
      const cols = columns(section.texts.length);
      return <div className="story-part">
        <div className="story-grid">{section.texts.map((text, i) => <Copy key={text.title} text={text} chapter={chapter} delay={i * .1} style={{ gridColumn: section.texts.length === 1 ? `${CONTENT_START} / 9` : cols[i] }} />)}</div>
        <div className="story-grid story-rows">{section.rows.map((row, k) => <Row key={k} row={row} alt={`${title} — ${section.texts[0].title}`} />)}</div>
      </div>;
    }
  }
}

// A project told from its portfolio slides, in chapters: an overview (cover, introduction, facts, key numbers),
// the story's chapters, then its films. An index in the left columns (a line at the top on phones) shows which
// chapter is being read and jumps between them. Text rises into place and images open up as they scroll in.
export default function ProjectStory({ story, year, films = [] }: { story: Story; year?: string; films?: Film[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const chapters = story.sections.reduce<Array<{ name: string; sections: StorySection[] }>>((list, section) => {
    const last = list[list.length - 1];
    if (last && last.name === section.chapter) last.sections.push(section); else list.push({ name: section.chapter, sections: [section] });
    return list;
  }, []);
  const index = ['Overview', ...chapters.map(c => c.name), ...(films.length ? ['Film'] : [])];
  const [current, setCurrent] = useState(0);
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const root = rootRef.current!, reduce = reducedMotion();
    const parts = Array.from(root.querySelectorAll<HTMLElement>('.story-chapter'));
    const reading = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) setCurrent(parts.indexOf(entry.target as HTMLElement));
    }), { rootMargin: '-45% 0px -54% 0px' });
    parts.forEach(el => reading.observe(el));
    const hero = new IntersectionObserver(([entry]) => setPastHero(!entry.isIntersecting), { rootMargin: '0px 0px -40% 0px' });
    hero.observe(root.querySelector('.story-hero')!);
    // Key numbers count up from zero as they come into view.
    const count = (el: HTMLElement) => {
      const value = Number(el.dataset.value), decimals = Number(el.dataset.decimals || 0);
      if (reduce) { el.textContent = value.toFixed(decimals); return; }
      const begin = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - begin) / 1400), eased = 1 - Math.pow(1 - t, 3);
        el.textContent = (value * eased).toFixed(decimals);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const shown = root.querySelectorAll<HTMLElement>('.story-rv, .story-media:not(.is-in), [data-value]');
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target as HTMLElement;
      if (el.dataset.value) count(el); else el.classList.add('is-in');
      io.unobserve(el);
    }), { rootMargin: '0px 0px -12% 0px', threshold: .01 });
    shown.forEach(el => io.observe(el));
    // Drift: each image's inner layer moves against the scroll by a share of its distance from the screen's middle.
    const drifting = Array.from(root.querySelectorAll<HTMLElement>('[data-drift]'));
    let frame = 0;
    const place = () => {
      frame = 0;
      if (reduce) return;
      const middle = window.innerHeight / 2;
      for (const el of drifting) {
        const box = el.parentElement!.getBoundingClientRect();
        if (box.bottom < -200 || box.top > window.innerHeight + 200) continue;
        el.style.transform = `translate3d(0,${((box.top + box.height / 2 - middle) * -Number(el.dataset.drift)).toFixed(1)}px,0)`;
      }
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(place); };
    window.addEventListener('scroll', request, { passive: true }); window.addEventListener('resize', request); place();
    return () => { reading.disconnect(); hero.disconnect(); io.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('scroll', request); window.removeEventListener('resize', request); };
  }, [story, films.length]);

  const jump = (i: number) => {
    const target = rootRef.current?.querySelectorAll<HTMLElement>('.story-chapter')[i];
    if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 60, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  const head = (i: number, name: string) => (
    <header className="story-grid story-chapter-head">
      <div style={{ gridColumn: `${CONTENT_START} / ${CONTENT_END}` }}>
        <p className="story-rv"><span>{pad(i)}</span>{story.kickers?.[name]}</p>
        <h2 className="story-rv" style={{ transitionDelay: '.08s' }}>{name}</h2>
      </div>
    </header>
  );

  return (
    <div className="story" ref={rootRef}>
      <nav className={'story-index' + (pastHero ? ' is-shown' : '')} aria-label={`${story.name} chapters`}>
        <ol>
          {index.map((name, i) => <li key={name}>
            <button type="button" className={i === current ? 'is-current' : undefined} aria-current={i === current ? 'true' : undefined} onClick={() => jump(i)}>
              <span>{pad(i)}</span>{name}
            </button>
          </li>)}
        </ol>
      </nav>
      <p className={'story-now' + (pastHero ? ' is-shown' : '')} aria-hidden="true"><span>{pad(current)}</span>{index[current]}</p>

      <section className="story-chapter story-overview" aria-label="Overview">
        <div className="story-hero">
          <Figure image={story.hero} alt={story.name} drift={.08} />
          <div className="story-hero-title">
            <p className="story-rv">{[year, story.kickers?.Overview].filter(Boolean).join(' · ') || ' '}</p>
            <h1 className="story-rv" style={{ transitionDelay: '.1s' }}>{story.name}</h1>
          </div>
        </div>
        <div className="story-grid story-intro">
          <div className="story-intro-main" style={{ gridColumn: `${CONTENT_START} / 9` }}>
            <p className="story-lead story-rv">{story.intro.ko}</p>
            {story.intro.en && <p className="story-lead-en story-rv" style={{ transitionDelay: '.12s' }}>{story.intro.en}</p>}
            {story.intro.image && <div className="story-intro-image"><Figure image={story.intro.image} alt={story.name} drift={.04} /></div>}
          </div>
          <dl className="story-facts" style={{ gridColumn: `10 / ${CONTENT_END}` }}>
            {year && <div className="story-rv"><dt>Year</dt><dd>{year}</dd></div>}
            {story.facts.map(([term, value], i) => <div className="story-rv" style={{ transitionDelay: `${(i + 1) * .08}s` }} key={term}><dt>{term}</dt><dd>{value}</dd></div>)}
          </dl>
        </div>
        {story.stats && <div className="story-grid">
          <ul className="story-stats" style={{ gridColumn: `${CONTENT_START} / ${CONTENT_END}` }}>
            {story.stats.map((stat, i) => <li key={stat.label} className="story-rv" style={{ transitionDelay: `${i * .08}s` }}>
              <strong><span data-value={stat.value} data-decimals={stat.decimals || 0}>{(0).toFixed(stat.decimals || 0)}</span>{stat.unit && <small>{stat.unit}</small>}</strong>
              <em>{stat.label}</em>
            </li>)}
          </ul>
        </div>}
      </section>

      {chapters.map((chapter, c) => (
        <section className="story-chapter" key={chapter.name} aria-label={chapter.name}>
          {head(c + 1, chapter.name)}
          {chapter.sections.map((section, s) => <Part key={s} section={section} title={story.name} />)}
        </section>
      ))}
      {films.length > 0 && <section className="story-chapter" aria-label="Film">
        {head(chapters.length + 1, 'Film')}
        <div className="story-grid story-films">
          {films.map((film, i) => <video key={film.url} src={film.url} poster={film.poster} controls muted playsInline preload="metadata" aria-label={`${story.name} film ${i + 1}`} style={{ gridColumn: `${CONTENT_START} / ${CONTENT_END}` }} />)}
        </div>
      </section>}
    </div>
  );
}
