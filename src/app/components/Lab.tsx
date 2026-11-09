import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import SiteShell from './SiteShell';
import { experiments, type Experiment } from '../../lib/labExperiments';
import '../../styles/lab.css';

const rigs = experiments.filter(e => e.kind === 'RIG');

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

// The live rigs themselves, mounted into their sheet once it comes near the screen (and kept after).
const rigPieces: Record<string, { Piece: React.LazyExoticComponent<React.ComponentType<{ className?: string }>>; hint: string }> = {
  '/lab/astronaut-tail': { Piece: lazy(() => import('./AstroTail')), hint: 'Move the cursor across it' },
  '/lab/dual-arm-ik': { Piece: lazy(() => import('./DualArmIK')), hint: 'Drag a hand or an arm' },
  '/lab/horse': { Piece: lazy(() => import('./HorseMotion')), hint: 'Click to crouch' },
};
function LiveRig({ e }: { e: Experiment }) {
  const ref = useRef<HTMLDivElement>(null), [near, setNear] = useState(false), rig = rigPieces[e.to];
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="lab-sheet-plate is-live">
      {near ? <Suspense fallback={null}><rig.Piece className="lab-rig" /></Suspense> : <Media media={e.media} alt={e.name} />}
      <span className="lab-live-hint"><i />{rig.hint}</span>
    </div>
  );
}

const Go = ({ e }: { e: Experiment }) => e.external
  ? <a className="lab-go" href={e.to} target="_blank" rel="noreferrer">{e.action} ↗</a>
  : <Link className="lab-go" to={e.to}>{e.kind === 'RIG' ? 'Open full screen' : e.action} →</Link>;

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
        {rigs.map((e, i) => {
          const a = (i * 120 - 90) * Math.PI / 180, x = Math.cos(a), y = Math.sin(a);
          const side = Math.abs(x) < .2 ? 'is-mid' : x > 0 ? 'is-right' : 'is-left';
          return (
            <a key={e.code} href={'#' + e.code} className={'lab-ring-label ' + side} style={{ left: 50 + x * 64 + '%', top: 50 + y * 62 + '%' }}>
              <span>{e.code}</span>{e.name}.<br />{e.field}.
            </a>
          );
        })}
      </div>
      <ol className="lab-ring-list">
        {rigs.map(e => <li key={e.code}><a href={'#' + e.code}><span>{e.code}</span>{e.name}</a></li>)}
      </ol>
      <p className="lab-ring-line">Not just a portfolio.<br /><u>A working laboratory.</u></p>
    </section>
  );
}

// One experiment as a ruled specification sheet.
function Sheet({ e }: { e: Experiment }) {
  const plate = 'lab-sheet-plate' + (e.media.fill ? ' is-fill' : e.media.h > e.media.w * 1.3 ? ' is-tall' : '');
  return (
    <article className="lab-card lab-sheet" id={e.code} aria-labelledby={e.code + '-name'}>
      <div className="lab-cell lab-sheet-head"><h3 id={e.code + '-name'}>{e.name} — {e.field}</h3></div>
      <div className="lab-cell lab-sheet-mark"><span>{e.code}</span><span>{e.kind === 'RIG' ? 'Live rig' : 'Study'}</span></div>
      <div className="lab-cell lab-sheet-text">
        <p>{e.note}</p>
        <p className="lab-sheet-big">{e.name}</p>
      </div>
      <div className="lab-cell lab-sheet-media">{rigPieces[e.to] ? <LiveRig e={e} /> : <div className={plate}><Media media={e.media} alt={e.name} /></div>}</div>
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

// JAYDNE LABORATORY: the live rigs behind the projects, laid out as a deck of sheets.
export default function Lab() {
  return (
    <SiteShell active="motion">
      <main className="lab">
        <Cover />
        <Index />
        {rigs.map(e => <Sheet key={e.code} e={e} />)}
        <footer className="lab-foot"><span>Jaydne Laboratory</span><span>Experiments are added as they are made.</span></footer>
      </main>
    </SiteShell>
  );
}
