import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import SiteShell from './SiteShell';
import { experiments, type Experiment } from '../../lib/labExperiments';
import '../../styles/lab.css';

const rigs = experiments.filter(e => e.kind === 'RIG'), studies = experiments.filter(e => e.kind === 'STUDY');
const two = (n: number) => String(n).padStart(2, '0');

// Loops play only while on screen; a still poster stands in for reduced motion.
function Media({ media, alt }: { media: Experiment['media']; alt: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) video.play().catch(() => {}); else video.pause(); }, { threshold: .2 });
    io.observe(video);
    return () => io.disconnect();
  }, []);
  return media.video
    ? <video ref={ref} src={media.src} poster={media.poster} muted loop playsInline preload="metadata" aria-label={alt} />
    : <img src={media.src} alt={alt} width={media.w} height={media.h} loading="lazy" />;
}

const Go = ({ e }: { e: Experiment }) => e.external
  ? <a className="lab-go" href={e.to} target="_blank" rel="noreferrer">{e.action} ↗</a>
  : <Link className="lab-go" to={e.to}>{e.action} →</Link>;

// The cover: an image band, a giant word block, and the specimen floating across the seam.
function Cover() {
  return (
    <section className="lab-card lab-cover" aria-labelledby="lab-title">
      <div className="lab-cover-band"><img src="/projects/miro/site/arm.webp" alt="" /></div>
      <img className="lab-cover-object" src="/projects/lab/astronaut.webp" alt="" />
      <div className="lab-cover-panel">
        <h1 id="lab-title" className="lab-cover-title">Jaydne<br />Laboratory</h1>
        <span className="lab-cover-tag">Experiment index</span>
        <div className="lab-cover-foot"><span>November 2026</span><span>V.01</span></div>
      </div>
    </section>
  );
}

// The index: one object in the middle, a ring of points, every experiment named around it.
function Index() {
  return (
    <section className="lab-card lab-ring-card" aria-labelledby="lab-index-title">
      <h2 id="lab-index-title" className="lab-label lab-center">The index</h2>
      <div className="lab-ring">
        <img className="lab-ring-object" src="/projects/miro/site/cv1.webp" alt="" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 + 15) * Math.PI / 180;
          return <i key={i} className="lab-ring-dot" style={{ left: 50 + Math.cos(a) * 47 + '%', top: 50 + Math.sin(a) * 47 + '%' }} />;
        })}
        {experiments.map((e, i) => {
          const a = (i * 60 - 90) * Math.PI / 180, x = Math.cos(a), y = Math.sin(a);
          const side = Math.abs(x) < .2 ? 'is-mid' : x > 0 ? 'is-right' : 'is-left';
          return (
            <a key={e.code} href={'#' + e.code} className={'lab-ring-label ' + side} style={{ left: 50 + x * 64 + '%', top: 50 + y * 62 + '%' }}>
              <span>{e.code}</span>{e.name}.<br />{e.field}.
            </a>
          );
        })}
      </div>
      <ol className="lab-ring-list">
        {experiments.map(e => <li key={e.code}><a href={'#' + e.code}><span>{e.code}</span>{e.name}</a></li>)}
      </ol>
      <p className="lab-ring-line">Not just a portfolio.<br /><u>A working laboratory.</u></p>
    </section>
  );
}

// A set opener: tabs, a two-tone headline, a dial that marks where the set sits, a blurred specimen below.
function Opener({ id, active, lead, tail, copy, image, stats }: { id: string; active: 0 | 1; lead: string; tail: string; copy: string; image: string; stats: [string, string][] }) {
  const ticks = 33, at = active ? 22 : 10;
  return (
    <section className="lab-card lab-opener" id={id} aria-labelledby={id + '-title'}>
      <div className="lab-tabs" role="tablist" aria-label="Sets">
        <a href="#rigs" role="tab" aria-selected={!active} className={!active ? 'is-on' : ''}>Rigs</a>
        <a href="#studies" role="tab" aria-selected={!!active} className={active ? 'is-on' : ''}>Studies</a>
      </div>
      <h2 id={id + '-title'} className="lab-opener-title">{lead}<br /><span>{tail}</span></h2>
      <p className="lab-opener-copy">{copy}</p>
      <svg className="lab-dial" viewBox="0 0 800 150" aria-hidden="true">
        {Array.from({ length: ticks }, (_, i) => {
          const a = (-38 + i * 76 / (ticks - 1)) * Math.PI / 180, r = 900, cx = 400, cy = 960;
          const x1 = cx + Math.sin(a) * r, y1 = cy - Math.cos(a) * r, x2 = cx + Math.sin(a) * (r - 38), y2 = cy - Math.cos(a) * (r - 38);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={i <= at ? 'on' : ''} style={{ opacity: i <= at ? .35 + .65 * (i / at) : Math.max(.12, .5 - (i - at) * .03) }} />;
        })}
        {(() => { const a = (-38 + at * 76 / (ticks - 1)) * Math.PI / 180; return <circle cx={400 + Math.sin(a) * 922} cy={960 - Math.cos(a) * 922} r="9" />; })()}
      </svg>
      <div className="lab-opener-blur"><img src={image} alt="" /></div>
      <dl className="lab-opener-stats">
        {stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </section>
  );
}

// One experiment as a ruled specification sheet.
function Sheet({ e }: { e: Experiment }) {
  const plate = 'lab-sheet-plate' + (e.media.fill ? ' is-fill' : e.media.h > e.media.w * 1.3 ? ' is-tall' : '');
  return (
    <article className="lab-card lab-sheet" id={e.code} aria-labelledby={e.code + '-name'}>
      <div className="lab-cell lab-sheet-head"><h3 id={e.code + '-name'}>{e.name} — {e.field}</h3></div>
      <div className="lab-cell lab-sheet-mark"><span>{e.code}</span><b>Jaydne Lab</b></div>
      <div className="lab-cell lab-sheet-text">
        <p>{e.note}</p>
        <p className="lab-sheet-big">{e.name}</p>
      </div>
      <div className="lab-cell lab-sheet-media"><div className={plate}><Media media={e.media} alt={e.name} /></div></div>
      <div className="lab-cell lab-sheet-go"><Go e={e} /></div>
      <div className="lab-cell lab-sheet-spec">
        <h4>Experiment characteristics</h4>
        <dl>
          <div><dt>Type</dt><dd>{e.kind === 'RIG' ? 'Live rig, runs in the browser.' : 'Study, documented in its project.'}</dd></div>
          <div><dt>Input</dt><dd>{e.input}.</dd></div>
          <div><dt>Field</dt><dd>{e.field}.</dd></div>
          <div><dt>Tools</dt><dd>{e.tools}.</dd></div>
        </dl>
      </div>
    </article>
  );
}

// JAYDNE LABORATORY: the interactive rigs and small studies behind the projects, laid out as a deck of sheets.
export default function Lab() {
  return (
    <SiteShell active="motion">
      <main className="lab">
        <Cover />
        <Index />
        <Opener id="rigs" active={0} lead="Movement you can" tail="drag, press and run."
          copy="직접 끌고, 누르고, 흔들어 보는 움직임 실험. 브라우저 안에서 바로 실행됩니다."
          image="/projects/miro/site/hero.webp" stats={[['Live rigs', two(rigs.length)], ['Input', 'Drag · Press · Cursor']]} />
        {rigs.map(e => <Sheet key={e.code} e={e} />)}
        <Opener id="studies" active={1} lead="Small parts," tail="tested on their own."
          copy="프로젝트 안에서 따로 떼어 실험한 장치와 화면."
          image="/projects/identity/motion/liquid-pour.webp" stats={[['Studies', two(studies.length)], ['Total', two(experiments.length) + ' experiments']]} />
        {studies.map(e => <Sheet key={e.code} e={e} />)}
        <footer className="lab-foot"><span>Jaydne Laboratory</span><span>Experiments are added as they are made.</span></footer>
      </main>
    </SiteShell>
  );
}
