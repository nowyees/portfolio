import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import SiteShell from './SiteShell';
import { experiments, type Experiment } from '../../lib/labExperiments';
import { useT } from '../../lib/i18n';
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
type PieceInfo = { Piece?: Piece; frame?: string; hint: string; type: string; open: string; web?: boolean; hintKo: string; typeKo: string; openKo: string };
const pieces: Record<string, PieceInfo> = {
  'EX-01': { Piece: lazy(() => import('./AstroTail')), hint: 'Move your cursor across it. On a phone, tap around it and the tail swings to where you tapped.', type: 'Live rig, runs in the browser.', open: 'Open full screen',
    hintKo: '커서를 꼬리 주변으로 움직여 보세요. 폰에서는 꼬리 주변을 탭하면 그쪽으로 휩니다.', typeKo: '브라우저에서 바로 움직이는 리그.', openKo: '전체 화면으로 보기' },
  'EX-02': { Piece: lazy(() => import('./DualArmIK')), hint: 'Drag an arm, click a hand to close its fingers. Double-click to reset.', type: 'Live rig, runs in the browser.', open: 'Open full screen',
    hintKo: '팔을 끌어 움직이고, 손을 클릭하면 손가락을 오므립니다. 더블클릭하면 처음 자세로 돌아갑니다.', typeKo: '브라우저에서 바로 움직이는 리그.', openKo: '전체 화면으로 보기' },
  'EX-03': { Piece: lazy(() => import('./HorseMotion')), hint: 'Click it to crouch, click again to rise.', type: 'Live rig, runs in the browser.', open: 'Open full screen',
    hintKo: '클릭하면 몸을 낮추고, 다시 클릭하면 일어섭니다.', typeKo: '브라우저에서 바로 움직이는 리그.', openKo: '전체 화면으로 보기' },
  'EX-04': { Piece: lazy(() => import('./MiroInteraction')), hint: 'Call Miro, then pick a gesture. Turn on the webcam to use your own hands.', type: 'Interactive web, gesture recognition.', open: 'Open the web', web: true,
    hintKo: 'Miro를 부른 뒤 동작을 골라 보세요. 웹캠을 켜면 내 손동작으로도 반응합니다.', typeKo: '제스처를 인식하는 인터랙티브 웹.', openKo: '웹에서 열기' },
  // the robot cell is a full-screen scene of its own (with sound), so the sheet runs it in a frame
  'EX-05': { frame: '/lab/robot', hint: 'Click a robot to move it, or the car to move all four. Drag to look around. On a slower computer it lowers its own quality to keep up.', type: 'Real-time scene, Blender to three.js.', open: 'Open full screen',
    hintKo: '로봇을 클릭하면 그 로봇이 움직이고, 차를 클릭하면 네 대가 함께 움직입니다. 끌어서 둘러볼 수 있어요. 느린 컴퓨터에서는 스스로 품질을 낮춥니다.', typeKo: 'Blender에서 three.js로 옮긴 실시간 장면.', openKo: '전체 화면으로 보기' },
};

// A piece runs while its sheet is on or near the screen and is taken down once it is well away, so no more than one
// or two run at a time. (The robot cell lowers its own quality on a slower machine.)
function Plate({ e }: { e: Experiment }) {
  const ref = useRef<HTMLDivElement>(null), piece = pieces[e.code];
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: '200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // The robot cell is told when its sheet leaves the view and comes back, so its sound follows.
  useEffect(() => {
    const el = ref.current;
    if (!el || !piece.frame || !near) return;
    const io = new IntersectionObserver(([entry]) => {
      el.querySelector('iframe')?.contentWindow?.postMessage({ robotCell: entry.isIntersecting ? 'shown' : 'hidden' }, location.origin);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [near, piece.frame]);
  return (
    <div ref={ref} className={'lab-sheet-plate is-live' + (piece.web ? ' is-web' : '') + (piece.frame ? ' is-frame' : '') + (e.media.fill ? ' is-fill' : '')}>
      {!near ? <Media media={e.media} alt={e.name} />
        : piece.frame ? <iframe className="lab-frame" src={piece.frame} title={e.name} allow="autoplay; fullscreen" />
        : piece.Piece && <Suspense fallback={null}><piece.Piece className={'lab-rig' + (piece.web ? ' lab-web' : '')} /></Suspense>}
    </div>
  );
}

// One experiment as a ruled specification sheet: name, text, how to play and its characteristics on the left,
// the live piece on the right.
function Sheet({ e }: { e: Experiment }) {
  const ref = useReveal<HTMLElement>(), piece = pieces[e.code], t = useT();
  return (
    <article ref={ref} className="lab-card lab-sheet" id={e.code} aria-labelledby={e.code + '-name'}>
      <div className="lab-cell lab-sheet-head"><h2 id={e.code + '-name'}>{e.name} — {e.field}</h2></div>
      <div className="lab-cell lab-sheet-mark"><span>{e.code}</span><span>{piece.web ? 'Interactive web' : piece.frame ? 'Live scene' : 'Live rig'}</span></div>
      <div className="lab-cell lab-sheet-text">
        <p>{t(e.noteKo ?? e.note, e.note)}</p>
        <div className="lab-sheet-try"><h3><i aria-hidden="true" />Try it</h3><p>{t(piece.hintKo, piece.hint)}</p></div>
        <div className="lab-sheet-spec">
          <h3>Experiment characteristics</h3>
          <dl>
            <div><dt>Type</dt><dd>{t(piece.typeKo, piece.type)}</dd></div>
            <div><dt>Input</dt><dd>{t(e.inputKo ?? e.input, e.input + '.')}</dd></div>
            <div><dt>Field</dt><dd>{e.field}.</dd></div>
            <div><dt>Tools</dt><dd>{e.tools}.</dd></div>
          </dl>
          {e.external
            ? <a className="lab-go" href={e.to} target="_blank" rel="noreferrer">{t(piece.openKo, piece.open)} ↗</a>
            : <Link className="lab-go" to={e.to}>{t(piece.openKo, piece.open)} →</Link>}
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
