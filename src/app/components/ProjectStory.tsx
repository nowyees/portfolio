import React, { useEffect, useRef, useState } from 'react';
import type { ProjectStory as Story, StoryImage, StoryRow, StorySection, StoryText } from '../../lib/projectStories';

type Film = { url: string; poster?: string };
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = (n: number) => String(n).padStart(2, '0');
const content = { gridColumn: '3 / 13' };

function Figure({ image, alt, priority = false, sizes = '(max-width: 900px) calc(100vw - 36px), 78vw' }:
  { image: StoryImage; alt: string; priority?: boolean; sizes?: string }) {
  return <figure className="story-figure">
    <div className="story-media">
      <img src={image.src} srcSet={image.srcSet} sizes={image.srcSet ? sizes : undefined}
        alt={alt} width={image.w} height={image.h} loading={priority ? 'eager' : 'lazy'}
        decoding="async" />
    </div>
    {image.caption && <figcaption>{image.caption}</figcaption>}
  </figure>;
}

function Row({ row, alt }: { row: StoryRow; alt: string }) {
  const span = row.span || 10, start = row.align === 'end' ? 13 - span : 3;
  return <div className={'story-row' + (row.images.length > 1 ? ' is-multiple' : '')}
    style={{ gridColumn: `${start} / ${start + span}` }}>
    {row.images.map((image, i) => <Figure key={image.src} image={image}
      alt={image.caption || `${alt} — ${i + 1}`}
      sizes={`(max-width: 900px) ${row.images.length > 1 ? '46vw' : '92vw'}, ${Math.round(span / 12 * 100 / row.images.length)}vw`} />)}
  </div>;
}

function Copy({ text, chapter }: { text: StoryText; chapter: string }) {
  const showTitle = text.title.toLowerCase() !== chapter.toLowerCase();
  return <div className={'story-copy' + (!showTitle ? ' is-caption' : '')}>
    {showTitle && <h3>{text.title}</h3>}
    <p>{text.body}</p>
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
    case 'feature': return <div className="story-part story-feature">
      <div className="story-grid"><div style={content}><Figure image={section.image} alt={`${title} — ${section.text.title}`} /></div></div>
      {copy(section.text)}{after && rows(after)}
    </div>;
    case 'pinned': return <div className="story-part story-mechanisms">
      {section.steps.map(step => <article className="story-mechanism" key={step.text.title} data-part={step.text.title}>
        <div className="story-grid"><div className="story-mechanism-images" style={content}>
          {step.images.map((image, i) => <Figure key={image.src} image={image}
            alt={`${title} — ${step.text.title} ${i + 1}`}
            sizes="(max-width: 600px) 90vw, (max-width: 900px) 44vw, 38vw" />)}
        </div></div>
        {copy(step.text)}
      </article>)}
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
      <div className="story-grid"><div className="story-process-images" style={content}>
        {section.images.map((image, i) => <Figure key={image.src} image={image}
          alt={`${title} — Prototyping ${i + 1}`}
          sizes="(max-width: 600px) 90vw, (max-width: 900px) 44vw, 38vw" />)}
      </div></div>
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
    const parts = Array.from(rootRef.current!.querySelectorAll<HTMLElement>('.story-chapter'));
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * .35;
      let active = 0;
      parts.forEach((part, i) => { if (part.getBoundingClientRect().top <= line) active = i; });
      setCurrent(active);
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => {
      cancelAnimationFrame(frame);
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
    <div style={content}><span>{pad(i)}</span><h2>{name}</h2></div>
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
        <div style={content}><h1>{story.name}</h1><p>Space mobility<br />{year}</p></div>
      </header>
      <div className="story-grid story-hero"><div style={content}>
        <Figure image={story.hero} alt={`${story.name} — wearable tail in zero gravity`} priority />
      </div></div>
      <div className="story-grid story-intro">
        <div className="story-intro-main">
          <p className="story-lead">{story.intro.ko}</p>
          {story.intro.en && <p className="story-lead-en" lang="en">{story.intro.en}</p>}
        </div>
        <dl className="story-facts">{story.facts.map(([term, value]) =>
          <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
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
