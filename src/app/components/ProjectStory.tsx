import React, { useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { PIN_STEP, pinnedStepIndex } from '../../lib/pinnedSteps';
import type { ProjectStory as Story, StoryClip, StoryImage, StoryRow, StorySection, StoryText } from '../../lib/projectStories';

type Film = { url: string; poster?: string };
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = (n: number) => String(n).padStart(2, '0');
const content = { gridColumn: '3 / 13' };
const ratioOf = (image: StoryImage) => image.video ? image.video.w / image.video.h : (image.frame?.w || image.w) / (image.frame?.h || image.h);

function MotionImage({ clip, active }: { clip: StoryClip; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const intent = useRef<'auto' | 'play' | 'pause'>('auto');
  const syncRef = useRef<() => void>(() => {});
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false, disposed = false;
    const sync = () => {
      const allowed = active && visible && !document.hidden && intent.current !== 'pause'
        && (intent.current === 'play' || !motion.matches);
      if (allowed) {
        video.play().then(() => { if (disposed) video.pause(); }).catch(() => {});
      } else video.pause();
    };
    syncRef.current = sync;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= .25; sync();
    }, { threshold: [0, .25] });
    observer.observe(video);
    motion.addEventListener('change', sync); document.addEventListener('visibilitychange', sync);
    video.addEventListener('canplay', sync);
    return () => {
      disposed = true; observer.disconnect(); video.pause(); syncRef.current = () => {};
      motion.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync);
      video.removeEventListener('canplay', sync);
    };
  }, [clip.src, active, failed]);
  if (failed) return <img src={clip.poster} alt={clip.caption} width={clip.w} height={clip.h} />;
  return <>
    <video ref={ref} src={clip.src} poster={clip.poster} width={clip.w} height={clip.h}
      muted loop playsInline preload="none" aria-label={clip.caption}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)} />
    <button className={'story-motion-toggle' + (playing ? ' is-playing' : '')} type="button" tabIndex={active ? 0 : -1}
      aria-label={`${clip.caption} — ${playing ? '일시정지' : '재생'}`} onClick={() => {
        intent.current = playing ? 'pause' : 'play'; syncRef.current();
      }}><span aria-hidden="true" /></button>
  </>;
}

function Figure({ image, alt, priority = false, delay = 0, drift = false, revealed = false, active = true, style,
  sizes = '(max-width: 900px) calc(100vw - 36px), 78vw' }:
  { image: StoryImage; alt: string; priority?: boolean; sizes?: string; delay?: number;
    drift?: boolean; revealed?: boolean; active?: boolean; style?: React.CSSProperties }) {
  return <figure className="story-figure" style={{ flex: `${ratioOf(image)} 1 0`, ...style }}>
    <div className={'story-media' + (revealed ? ' is-in' : '')}
      style={{ aspectRatio: String(ratioOf(image)), transitionDelay: `${delay}s` }}>
      <div className="story-reveal-zoom"><div className={'story-image-plane' + (drift ? ' has-drift' : '')}>
        {image.video ? <MotionImage clip={image.video} active={active} /> : <img draggable={false}
        src={image.src} srcSet={image.srcSet} sizes={image.srcSet ? sizes : undefined}
        alt={alt} width={image.w} height={image.h} loading={priority ? 'eager' : 'lazy'}
        decoding="async" />}
      </div></div>
    </div>
    {image.caption && <figcaption className="story-rv">{image.caption}</figcaption>}
  </figure>;
}

function Row({ row, alt }: { row: StoryRow; alt: string }) {
  const span = row.span || 10, start = row.align === 'end' ? 13 - span : 3;
  return <div className={'story-row' + (row.images.length > 1 ? ' is-multiple' : '')}
    style={{ gridColumn: `${start} / ${start + span}` }}>
    {row.images.map((image, i) => <Figure key={image.src} image={image} delay={i * .1}
      alt={image.caption || `${alt} — ${i + 1}`}
      sizes={`(max-width: 900px) ${row.images.length > 1 ? '46vw' : '92vw'}, ${Math.round(span / 12 * 100 / row.images.length)}vw`} />)}
  </div>;
}

function Copy({ text, chapter }: { text: StoryText; chapter: string }) {
  const showTitle = text.title.toLowerCase() !== chapter.toLowerCase();
  return <div className={'story-copy' + (!showTitle ? ' is-caption' : '')}>
    {showTitle && <h3 className="story-rv">{text.title}</h3>}
    <p className="story-rv">{text.body}</p>
  </div>;
}

function BackgroundClip({ clip }: { clip: StoryClip }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current!;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false, userPaused = false, automaticPause = false;
    const sync = () => {
      if (visible && !motion.matches && !userPaused && !document.hidden) {
        video.play().catch(() => { /* Native controls remain available if autoplay is blocked. */ });
      } else if (!video.paused) {
        automaticPause = true; video.pause();
      }
    };
    const onPause = () => {
      if (!automaticPause && visible && !document.hidden) userPaused = true;
      automaticPause = false;
    };
    const onPlay = () => { userPaused = false; };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting && entry.intersectionRatio >= .25; sync(); }, { threshold: [0, .25] });
    observer.observe(video);
    video.addEventListener('pause', onPause); video.addEventListener('play', onPlay);
    motion.addEventListener('change', sync); document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect(); motion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      video.removeEventListener('pause', onPause); video.removeEventListener('play', onPlay);
      video.pause();
    };
  }, [clip.src]);
  return <figure className="story-reference-clip">
    <video ref={videoRef} src={clip.src} poster={clip.poster} width={clip.w} height={clip.h}
      muted loop playsInline controls preload="none" aria-label={clip.caption} />
    <figcaption>{clip.caption}</figcaption>
  </figure>;
}

function Pinned({ steps, chapter, title }: {
  steps: Extract<StorySection, { kind: 'pinned' }>['steps']; chapter: string; title: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const element = root.current!;
    const mode = window.matchMedia('(min-width: 901px) and (prefers-reduced-motion: no-preference)');
    let frame = 0;
    // The scene follows ordinary scrolling: it changes every PIN_STEP of a screen as the section passes.
    const update = () => {
      frame = 0;
      setActive(pinnedStepIndex(-element.getBoundingClientRect().top, window.innerHeight * PIN_STEP, steps.length));
    };
    const changeMode = () => { setPinned(mode.matches); update(); };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    changeMode();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    mode.addEventListener('change', changeMode);
    return () => {
      cancelAnimationFrame(frame); window.removeEventListener('scroll', request); window.removeEventListener('resize', request);
      mode.removeEventListener('change', changeMode);
    };
  }, [steps]);
  return <div className="story-grid story-pin" ref={root}
    style={{ '--pin-count': steps.length } as React.CSSProperties} role="region" aria-label="Mechanism studies">
    <div className="story-pin-stage">
      <div className="story-pin-frame">{steps.map((step, i) => {
        const ratio = step.images.reduce((sum, image) => sum + ratioOf(image), 0);
        return <div className={'story-pin-layer' + (i === active ? ' is-active' : '')} key={step.text.title}
          aria-hidden={i !== active} data-step={step.text.title}>
          <div className="story-pin-visual"><div className="story-row" style={{ width: `min(100%, calc(100cqh * ${ratio}))` }}>
            {step.images.map((image, j) => <Figure key={image.video?.src || image.src} image={image} revealed active={i === active}
              alt={`${title} — ${step.text.title} ${j + 1}`}
              sizes="(max-width: 900px) 90vw, 50vw" />)}
          </div></div>
          {step.details && <div className="story-pin-details">{step.details.map(image => <Figure key={image.src}
            image={image} alt={`${title} — ${step.text.title} construction drawing`} revealed active={i === active}
            sizes="(max-width: 900px) 90vw, 54vw" />)}</div>}
        </div>;
      })}</div>
    </div>
    <div className="story-pin-steps"><div className="story-pin-copy-frame">{steps.map((step, i) => <article className={'story-pin-step' + (i === active ? ' is-active' : '')}
      key={step.text.title} data-step={step.text.title} aria-hidden={pinned && i !== active ? true : undefined}>
      <Copy text={step.text} chapter={chapter} />
      <div className="story-row story-pin-inline">{step.images.map((image, j) => <Figure key={image.video?.src || image.src}
        image={image} alt={`${title} — ${step.text.title} ${j + 1}`} sizes="(max-width: 600px) 90vw, 44vw" />)}</div>
      {step.details && <div className="story-pin-details story-pin-inline-details">{step.details.map(image => <Figure
        key={image.src} image={image} alt={`${title} — ${step.text.title} construction drawing`} sizes="90vw" />)}</div>}
    </article>)}</div></div>
  </div>;
}

function Strip({ images, title }: { images: StoryImage[]; title: string }) {
  const outer = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = outer.current!, rail = track.current!, viewport = el.querySelector<HTMLElement>('.story-strip-sticky')!;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const pinned = () => window.innerWidth > 900 && !motion.matches;
    const place = () => {
      frame = 0;
      if (!pinned()) { rail.style.transform = ''; return; }
      const travel = Math.max(0, rail.scrollWidth - viewport.clientWidth), box = el.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -box.top / Math.max(1, box.height - window.innerHeight)));
      rail.style.transform = `translate3d(${-progress * travel}px,0,0)`;
    };
    const size = () => {
      el.style.height = pinned() ? `${window.innerHeight + Math.max(0, rail.scrollWidth - viewport.clientWidth)}px` : '';
      place();
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(place); };
    const observer = new ResizeObserver(size);
    observer.observe(rail); observer.observe(viewport);
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', size); motion.addEventListener('change', size); size();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener('scroll', request); window.removeEventListener('resize', size);
      motion.removeEventListener('change', size);
    };
  }, [images]);
  return <div className="story-strip" ref={outer}>
    <div className="story-strip-sticky" tabIndex={0} role="region" aria-label={`${title} process images`}>
      <div className="story-strip-track" ref={track}>{images.map((image, i) => <Figure key={image.src}
        image={image} alt={`${title} — Prototyping ${i + 1}`} delay={i * .08}
        sizes="(max-width: 900px) 90vw, 70vw"
        style={{ flex: 'none', width: `calc(var(--strip-h) * ${ratioOf(image)})` }} />)}</div>
    </div>
  </div>;
}

function Gallery({ images, title }: { images: StoryImage[]; title: string }) {
  const [viewport, api] = useEmblaCarousel({ align: 'center', containScroll: false, loop: false });
  const [selected, setSelected] = useState(0);
  const [ends, setEnds] = useState({ prev: false, next: images.length > 1 });
  useEffect(() => {
    if (!api) return;
    const update = () => {
      setSelected(api.selectedScrollSnap());
      setEnds({ prev: api.canScrollPrev(), next: api.canScrollNext() });
    };
    update(); api.on('select', update); api.on('reInit', update);
    return () => { api.off('select', update); api.off('reInit', update); };
  }, [api]);
  const move = (direction: -1 | 1) => {
    if (direction < 0) api?.scrollPrev(reduceMotion());
    else api?.scrollNext(reduceMotion());
  };
  return <div className="story-gallery" role="region" aria-roledescription="carousel" aria-label={title}
    style={{ '--gallery-ratio': Math.max(...images.map(ratioOf)) } as React.CSSProperties}>
    <div className="story-gallery-viewport" ref={viewport} tabIndex={0}
      aria-label="Exhibition images. Drag, swipe or use the left and right arrow keys."
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }}>
      <div className="story-gallery-track">{images.map((image, i) =>
        <div className="story-gallery-slide" key={image.src} role="group" aria-roledescription="slide"
          aria-label={`${i + 1} / ${images.length}`}
          style={{ width: `calc(var(--gallery-h) * ${ratioOf(image)})` }}>
          <Figure image={image} alt={`${title} ${i + 1}`} revealed
            sizes="(max-width: 900px) 92vw, 75vw" />
        </div>)}</div>
    </div>
    <div className="story-gallery-controls">
      <span aria-live="polite" aria-atomic="true">{pad(selected + 1)} / {pad(images.length)}</span>
      <button type="button" disabled={!ends.prev} onClick={() => move(-1)} aria-label="Previous exhibition image"
        className="story-gallery-arrow is-prev"><span aria-hidden="true" /></button>
      <button type="button" disabled={!ends.next} onClick={() => move(1)} aria-label="Next exhibition image"
        className="story-gallery-arrow is-next"><span aria-hidden="true" /></button>
    </div>
  </div>;
}

function Part({ section, title }: { section: StorySection; title: string }) {
  const chapter = section.chapter;
  const after = 'after' in section ? section.after : undefined;
  const rows = (items: StoryRow[]) => <div className="story-grid story-rows">
    {items.map((row, i) => <Row key={i} row={row} alt={`${title} — ${chapter}`} />)}
  </div>;
  const copy = (text: StoryText) => <div className="story-grid"><div style={content}><Copy text={text} chapter={chapter} /></div></div>;
  switch (section.kind) {
    case 'context': return <div className="story-part story-context">
      <div className="story-grid story-context-intro">
        <div className="story-context-video"><BackgroundClip clip={section.clip} /></div>
        <div className="story-context-copy"><Copy text={section.text} chapter={chapter} /></div>
      </div>
      {rows(section.rows)}
    </div>;
    case 'feature': return <div className="story-part story-feature">
      <div className="story-grid"><div style={content}><Figure image={section.image} alt={`${title} — ${section.text.title}`} drift /></div></div>
      {copy(section.text)}{after && rows(after)}
    </div>;
    case 'pinned': return <div className="story-part story-mechanisms">
      <Pinned steps={section.steps} chapter={chapter} title={title} />
      {after && rows(after)}
    </div>;
    case 'compare': return <div className="story-part">
      {section.text && copy(section.text)}
      <div className="story-grid"><div className="story-compare" style={content}>
        {section.items.map(item => <article key={item.text.title}>
          <Figure image={item.image} alt={`${title} — ${item.text.title}`}
            sizes="(max-width: 600px) 90vw, (max-width: 900px) 44vw, 38vw" />
          <Copy text={item.text} chapter={chapter} />
        </article>)}
      </div></div>
    </div>;
    case 'strip': return <div className="story-part story-process">
      {copy(section.text)}
      <Strip images={section.images} title={title} />
    </div>;
    case 'gallery': return <div className="story-part story-exhibition">
      <div className="story-grid"><div style={content}><Gallery images={section.images} title={`${title} — ${chapter}`} /></div></div>
      {copy(section.text)}
    </div>;
    default: return <div className="story-part" data-part={section.texts[0]?.title}>
      {section.texts.map(text => <React.Fragment key={text.title}>{copy(text)}</React.Fragment>)}
      {rows(section.rows)}
    </div>;
  }
}

export default function ProjectStory({ story, year, films = [] }: { story: Story; year?: string; films?: Film[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const chapters = story.sections.reduce<Array<{ name: string; sections: StorySection[] }>>((list, section) => {
    const last = list[list.length - 1];
    if (last?.name === section.chapter) last.sections.push(section);
    else list.push({ name: section.chapter, sections: [section] });
    return list;
  }, []);
  const index = ['Overview', ...chapters.map(c => c.name), ...(films.length ? ['Film'] : [])];

  useEffect(() => {
    const root = rootRef.current!, motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const parts = Array.from(root.querySelectorAll<HTMLElement>('.story-chapter'));
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-in'); reveal.unobserve(entry.target); }
    }), { threshold: .01, rootMargin: '0px 0px -6% 0px' });
    root.querySelectorAll('.story-rv, .story-media:not(.is-in)').forEach(el => reveal.observe(el));
    const planes = Array.from(root.querySelectorAll<HTMLElement>('.story-image-plane.has-drift'));
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * .35;
      let active = 0;
      parts.forEach((part, i) => { if (part.getBoundingClientRect().top <= line) active = i; });
      setCurrent(active);
      planes.forEach(el => {
        const box = el.parentElement!.getBoundingClientRect();
        const shift = !motion.matches && window.innerWidth > 900
          ? Math.max(-box.height * .025, Math.min(box.height * .025, (window.innerHeight * .5 - box.top - box.height * .5) * .04)) : 0;
        el.closest<HTMLElement>('.story-figure')?.style.setProperty('--story-drift', `${shift}px`);
      });
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => {
      cancelAnimationFrame(frame);
      reveal.disconnect();
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', request);
    };
  }, [story, films.length]);

  const jump = (i: number) => {
    const target = rootRef.current?.querySelectorAll<HTMLElement>('.story-chapter')[i];
    const anchor = target?.querySelector<HTMLElement>('.story-chapter-head > div, .story-title > div');
    if (anchor) window.scrollTo({ top: anchor.getBoundingClientRect().top + window.scrollY - 80,
      behavior: reduceMotion() ? 'auto' : 'smooth' });
  };
  const head = (i: number, name: string) => <header className="story-grid story-chapter-head">
    <div style={content}><span className="story-rv">{pad(i)}</span><h2 className="story-rv">{name}</h2></div>
  </header>;

  return <div className="story" ref={rootRef}>
    <nav className="story-index" aria-label={`${story.name} chapters`}>
      <p>{story.name}</p>
      <ol>{index.map((name, i) => <li key={name}>
        <button type="button" className={current === i ? 'is-current' : undefined}
          aria-current={current === i ? 'location' : undefined} onClick={() => jump(i)}>
          <span>{pad(i)}</span>{name}
        </button>
      </li>)}</ol>
    </nav>
    <section className="story-chapter story-overview" aria-label="Overview">
      <header className="story-grid story-title">
        <div style={content}><h1 className="story-rv">{story.name}</h1><p className="story-rv">Space mobility<br />{year}</p></div>
      </header>
      <div className="story-grid story-hero"><div style={content}>
        <Figure image={story.hero} alt={`${story.name} — wearable tail in zero gravity`} priority />
      </div></div>
      <div className="story-grid story-intro">
        <div className="story-intro-main">
          <p className="story-lead story-rv">{story.intro.ko}</p>
          {story.intro.en && <p className="story-lead-en story-rv" lang="en">{story.intro.en}</p>}
        </div>
        <dl className="story-facts">{story.facts.map(([term, value]) =>
          <div className="story-rv" key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
      </div>
      {story.intro.image && <div className="story-grid"><div className="story-intro-image" style={content}>
        <Figure image={story.intro.image} alt={story.name} />
      </div></div>}
    </section>
    {chapters.map((chapter, i) => <section className="story-chapter" key={chapter.name} aria-label={chapter.name}>
      {head(i + 1, chapter.name)}
      {chapter.sections.map((section, j) => <Part key={j} section={section} title={story.name} />)}
    </section>)}
    {films.length > 0 && <section className="story-chapter" aria-label="Film">
      {head(chapters.length + 1, 'Film')}
      <div className="story-grid story-films">{films.map((film, i) =>
        <video key={film.url} src={film.url} poster={film.poster} controls muted playsInline
          preload="none" aria-label={`${story.name} film ${i + 1}`} style={content} />)}</div>
    </section>}
  </div>;
}
