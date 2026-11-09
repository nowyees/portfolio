import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import SiteShell from './SiteShell';
import { experiments, type Experiment } from '../../lib/labExperiments';
import '../../styles/lab.css';

const live = experiments.filter(e => e.kind === 'RIG').sort((a, b) => a.code.localeCompare(b.code));

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

// Adds .is-in once the element scrolls into view (sheets unfold from their centre line). A fully clipped element
// never counts as intersecting, so the sheet keeps a hairline open and fires once 20% into the view.
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.classList.add('is-in'); return; }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { el.classList.add('is-in'); io.disconnect(); } }, { rootMargin: '0px 0px -20% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

// The live pieces themselves, mounted into their sheet once it comes near the screen (and kept after).
type Piece = React.LazyExoticComponent<React.ComponentType<{ className?: string }>>;
const pieces: Record<string, { Piece?: Piece; frame?: string; hint: string; type: string; open: string; web?: boolean }> = {
  'EX-01': { Piece: lazy(() => import('./AstroTail')), hint: 'Move your cursor across it.', type: 'Live rig, runs in the browser.', open: 'Open full screen' },
  'EX-02': { Piece: lazy(() => import('./DualArmIK')), hint: 'Drag an arm, click a hand to close its fingers. Double-click to reset.', type: 'Live rig, runs in the browser.', open: 'Open full screen' },
  'EX-03': { Piece: lazy(() => import('./HorseMotion')), hint: 'Click it to crouch, click again to rise.', type: 'Live rig, runs in the browser.', open: 'Open full screen' },
  'EX-04': { Piece: lazy(() => import('./MiroInteraction')), hint: 'Call Miro, then pick a gesture. Turn on the webcam to use your own hands.', type: 'Interactive web, gesture recognition.', open: 'Open the web', web: true },
  // the robot cell is a full-screen scene of its own (with sound), so the sheet runs it in a frame
  'EX-05': { frame: '/lab/robot', hint: 'Click a robot to move it, or the car to move all four. Drag to look around.', type: 'Real-time scene, Blender to three.js.', open: 'Open full screen' },
};

function Plate({ e }: { e: Experiment }) {
  const ref = useRef<HTMLDivElement>(null), [near, setNear] = useState(false), piece = pieces[e.code];
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={'lab-sheet-plate is-live' + (piece.web ? ' is-web' : '') + (piece.frame ? ' is-frame' : '')}>
      {!near ? <Media media={e.media} alt={e.name} />
        : piece.frame ? <iframe className="lab-frame" src={piece.frame} title={e.name} allow="autoplay; fullscreen" loading="lazy" />
        : piece.Piece && <Suspense fallback={null}><piece.Piece className={'lab-rig' + (piece.web ? ' lab-web' : '')} /></Suspense>}
    </div>
  );
}

// One experiment as a ruled specification sheet: name, text, how to play and its characteristics on the left,
// the live piece on the right.
function Sheet({ e }: { e: Experiment }) {
  const ref = useReveal<HTMLElement>(), piece = pieces[e.code];
  return (
    <article ref={ref} className="lab-card lab-sheet" id={e.code} aria-labelledby={e.code + '-name'}>
      <div className="lab-cell lab-sheet-head"><h2 id={e.code + '-name'}>{e.name} — {e.field}</h2></div>
      <div className="lab-cell lab-sheet-mark"><span>{e.code}</span><span>{piece.web ? 'Interactive web' : piece.frame ? 'Live scene' : 'Live rig'}</span></div>
      <div className="lab-cell lab-sheet-text">
        <p>{e.note}</p>
        <div className="lab-sheet-try"><h3><i aria-hidden="true" />Try it</h3><p>{piece.hint}</p></div>
        <div className="lab-sheet-spec">
          <h3>Experiment characteristics</h3>
          <dl>
            <div><dt>Type</dt><dd>{piece.type}</dd></div>
            <div><dt>Input</dt><dd>{e.input}.</dd></div>
            <div><dt>Field</dt><dd>{e.field}.</dd></div>
            <div><dt>Tools</dt><dd>{e.tools}.</dd></div>
          </dl>
          {e.external
            ? <a className="lab-go" href={e.to} target="_blank" rel="noreferrer">{piece.open} ↗</a>
            : <Link className="lab-go" to={e.to}>{piece.open} →</Link>}
        </div>
      </div>
      <div className="lab-cell lab-sheet-media"><Plate e={e} /></div>
    </article>
  );
}

// JAYDNE LABORATORY: the live pieces, each a ruled sheet.
export default function Lab() {
  return (
    <SiteShell active="motion">
      <main className="lab">
        <h1 className="sr-only">Jaydne Laboratory</h1>
        {live.map(e => <Sheet key={e.code} e={e} />)}
        <footer className="lab-foot"><span>Jaydne Laboratory</span><span>Experiments are added as they are made.</span></footer>
      </main>
    </SiteShell>
  );
}
