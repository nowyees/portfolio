import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import SiteShell from './SiteShell';
import { experiments, type Experiment } from '../../lib/labExperiments';
import '../../styles/lab.css';

const rigs = experiments.filter(e => e.kind === 'RIG');
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

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

// Adds .is-in once the element scrolls into view (sheets unfold from their centre line).
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.classList.add('is-in'); return; }
    // (a fully clipped element never counts as intersecting, so the sheet keeps a hairline open and fires 20% into the view)
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { el.classList.add('is-in'); io.disconnect(); } }, { rootMargin: '0px 0px -20% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

// What the lab works across. The grid opens from a narrow strip to the full sheet as the page scrolls.
const fields = [
  { n: '01', title: 'Home robotics', line: 'Miro lives in the house: it pours, carries and reaches. Designed as a product, then rigged so its arms really move.',
    media: { src: '/projects/miro/site/hero.webp', w: 1672, h: 941 }, to: '#EX-02', go: 'Move its arms' },
  { n: '02', title: 'Interactive web', line: 'Every rig runs in the browser, not as a video: the real model, drawn as live line art, answering your cursor.',
    media: { src: '/projects/lab/horse.mp4', poster: '/projects/lab/horse.webp', w: 800, h: 448, video: true }, to: '#EX-01', go: 'Try the rigs' },
  { n: '03', title: 'AI', line: 'Hand and face tracking lets Miro answer a wave, a photo pose or rock-paper-scissors. AI-rendered studies come next.',
    media: { src: '/projects/miro/motion/ia-hi.mp4', poster: '/projects/miro/motion/ia-hi.webp', w: 720, h: 1280, video: true }, to: 'https://nowyees.github.io/miro-interaction/', go: 'Open the web', external: true },
];

function Fields() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(max-width: 760px)').matches;
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = el.getBoundingClientRect(), run = Math.max(1, box.height - innerHeight);
      const p = still ? 1 : clamp(-box.top / run);
      el.style.setProperty('--open', ease(clamp(p / .55)).toFixed(4));    // the grid spreads
      el.style.setProperty('--fill', ease(clamp((p - .4) / .45)).toFixed(4)); // the cells fill in
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, []);
  return (
    <section ref={ref} className="lab-fields" aria-labelledby="lab-title">
      <div className="lab-fields-stage">
        <div className="lab-fields-head">
          <h1 id="lab-title">Jaydne Laboratory</h1>
          <p>Home robotics, interactive web and AI, tested in the open.</p>
          <span>Scroll</span>
        </div>
        <div className="lab-fields-grid">
          {fields.map((f, i) => (
            <article key={f.n} className="lab-field" style={{ '--i': i } as React.CSSProperties}>
              <div className="lab-field-media"><Media media={f.media} alt={f.title} /></div>
              <div className="lab-field-copy">
                <span className="lab-field-n">{f.n}</span>
                <h2>{f.title}</h2>
                <p>{f.line}</p>
                {f.external
                  ? <a className="lab-go" href={f.to} target="_blank" rel="noreferrer">{f.go} ↗</a>
                  : <a className="lab-go" href={f.to}>{f.go} ↓</a>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// The live rigs themselves, mounted into their sheet once it comes near the screen (and kept after).
const rigPieces: Record<string, { Piece: React.LazyExoticComponent<React.ComponentType<{ className?: string }>>; hint: string }> = {
  '/lab/astronaut-tail': { Piece: lazy(() => import('./AstroTail')), hint: 'Move your cursor across it' },
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

// One experiment as a ruled specification sheet.
function Sheet({ e }: { e: Experiment }) {
  const ref = useReveal<HTMLElement>();
  return (
    <article ref={ref} className="lab-card lab-sheet" id={e.code} aria-labelledby={e.code + '-name'}>
      <div className="lab-cell lab-sheet-head"><h3 id={e.code + '-name'}>{e.name} — {e.field}</h3></div>
      <div className="lab-cell lab-sheet-mark"><span>{e.code}</span><span>Live rig</span></div>
      <div className="lab-cell lab-sheet-text">
        <p>{e.note}</p>
      </div>
      <div className="lab-cell lab-sheet-media"><LiveRig e={e} /></div>
      <div className="lab-cell lab-sheet-go"><Link className="lab-go" to={e.to}>Open full screen →</Link></div>
      <div className="lab-cell lab-sheet-spec">
        <h4>Experiment characteristics</h4>
        <dl>
          <div><dt>Type</dt><dd>Live rig, runs in the browser.</dd></div>
          <div><dt>Input</dt><dd>{e.input}.</dd></div>
          <div><dt>Field</dt><dd>{e.field}.</dd></div>
          <div><dt>Tools</dt><dd>{e.tools}.</dd></div>
        </dl>
      </div>
    </article>
  );
}

// JAYDNE LABORATORY: what the lab works across, then the live rigs as ruled sheets.
export default function Lab() {
  return (
    <SiteShell active="motion">
      <main className="lab">
        <Fields />
        {rigs.map(e => <Sheet key={e.code} e={e} />)}
        <footer className="lab-foot"><span>Jaydne Laboratory</span><span>Experiments are added as they are made.</span></footer>
      </main>
    </SiteShell>
  );
}
