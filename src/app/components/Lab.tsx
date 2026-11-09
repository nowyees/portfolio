import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import SiteShell from './SiteShell';
import { experiments, type Experiment } from '../../lib/labExperiments';
import '../../styles/lab.css';

const rigs = experiments.filter(e => e.kind === 'RIG'), studies = experiments.filter(e => e.kind === 'STUDY');
const Marks = () => <span className="lab-marks" aria-hidden="true">+ ×</span>;

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

function Specimen({ e, index }: { e: Experiment; index: number }) {
  const body = <>
    <div className={'lab-plate' + (e.media.h > e.media.w * 1.3 ? ' is-tall' : '')}>
      <Media media={e.media} alt={e.name} />
      <span className="lab-chip">{e.kind === 'RIG' ? 'Live rig' : 'Study'} · {e.code}</span>
    </div>
    <div className="lab-caption">
      <span className="lab-code">[{e.code}]<br />{e.field}</span>
      <p>{e.note}</p>
      <span className="lab-tools">{e.tools}</span>
      <span className="lab-name">{e.name}</span>
    </div>
    <span className="lab-action">[+] {e.action}{e.external ? ' ↗' : ''}</span>
  </>;
  const style = { '--i': index } as React.CSSProperties;
  return e.external
    ? <a className="lab-specimen" href={e.to} target="_blank" rel="noreferrer" style={style}>{body}</a>
    : <Link className="lab-specimen" to={e.to} style={style}>{body}</Link>;
}

// JAYDNE LABORATORY: the interactive rigs and small studies behind the projects.
export default function Lab() {
  return (
    <SiteShell active="motion">
      <main className="lab">
        <section className="lab-hero" aria-labelledby="lab-title">
          <img className="lab-hero-object" src="/projects/miro/site/cv1.webp" alt="" />
          <div className="lab-frost">
            <div className="lab-row lab-pills">
              <h1 id="lab-title" className="lab-pill">Jaydne Laboratory</h1>
              <span className="lab-pill">V. 01</span>
            </div>
            <div className="lab-row lab-crosses"><Marks /><Marks /><Marks /><Marks /></div>
            <div className="lab-row lab-ledger">
              <dl>
                <dt>Form + function:</dt>
                <dd><span>[01]</span>{rigs.length} interactive rigs.</dd>
                <dd><span>[02]</span>{studies.length} project studies.</dd>
              </dl>
              <dl>
                <dt>Index:</dt>
                {experiments.map(e => <dd key={e.code}><span>[{e.code}]</span>{e.name}.</dd>)}
              </dl>
            </div>
          </div>
          <p className="lab-scroll" aria-hidden="true">Scroll ↓</p>
        </section>

        <section className="lab-section" aria-label="Interactive rigs">
          <header className="lab-head"><span>[A]</span><h2>Interactive rigs</h2><p>직접 끌고, 누르고, 흔들어 보는 움직임 실험</p></header>
          <div className="lab-grid">{rigs.map((e, i) => <Specimen key={e.code} e={e} index={i} />)}</div>
        </section>
        <section className="lab-section" aria-label="Project studies">
          <header className="lab-head"><span>[B]</span><h2>Project studies</h2><p>프로젝트 안에서 따로 떼어 실험한 장치와 화면</p></header>
          <div className="lab-grid">{studies.map((e, i) => <Specimen key={e.code} e={e} index={i} />)}</div>
        </section>
        <footer className="lab-foot"><span>Jaydne Laboratory</span><span>Experiments are added as they are made.</span><span>V. 01 — 2026</span></footer>
      </main>
    </SiteShell>
  );
}
