import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import SiteShell from './SiteShell';
import { experiments, type Experiment } from '../../lib/labExperiments';
import '../../styles/lab.css';

const rigs = experiments.filter(e => e.kind === 'RIG'), studies = experiments.filter(e => e.kind === 'STUDY');

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

// One experiment as a specification sheet: text column left, the specimen right, ruled like a lab report.
function Sheet({ e }: { e: Experiment }) {
  const go = e.external
    ? <a className="lab-go" href={e.to} target="_blank" rel="noreferrer">{e.action} <span aria-hidden="true">↗</span></a>
    : <Link className="lab-go" to={e.to}>{e.action} <span aria-hidden="true">→</span></Link>;
  return (
    <article className="lab-sheet" aria-labelledby={'lab-' + e.code}>
      <div className="lab-sheet-label"><span>{e.code}</span><span>{e.kind === 'RIG' ? 'Live rig' : 'Study'}</span></div>
      <div className="lab-sheet-field">{e.field}</div>
      <div className="lab-sheet-copy">
        <h3 id={'lab-' + e.code}>{e.name}</h3>
        <p>{e.note}</p>
      </div>
      <div className={'lab-sheet-plate' + (e.media.fill ? ' is-fill' : e.media.h > e.media.w * 1.3 ? ' is-tall' : '')}><Media media={e.media} alt={e.name} /></div>
      <dl className="lab-sheet-spec">
        <div><dt>Input</dt><dd>{e.input}</dd></div>
        <div><dt>Tools</dt><dd>{e.tools}</dd></div>
      </dl>
      <div className="lab-sheet-go">{go}</div>
    </article>
  );
}

// JAYDNE LABORATORY: the interactive rigs and small studies behind the projects.
export default function Lab() {
  return (
    <SiteShell active="motion">
      <main className="lab">
        <section className="lab-hero" aria-labelledby="lab-title">
          <div className="lab-hero-top"><span>Experiments in motion, interaction and form</span><span>V.01 — 2026</span></div>
          <img className="lab-hero-object" src="/projects/miro/site/cv1.webp" alt="" />
          <h1 id="lab-title" className="lab-title"><span>Jaydne</span><span>Laboratory</span></h1>
          <div className="lab-hero-foot">
            <span>{String(experiments.length).padStart(2, '0')} experiments</span>
            <span>{String(rigs.length).padStart(2, '0')} rigs / {String(studies.length).padStart(2, '0')} studies</span>
            <span>Index ↓</span>
          </div>
        </section>

        <nav className="lab-index" aria-label="Experiment index">
          {experiments.map(e => <a key={e.code} href={'#lab-' + e.code}><span>{e.code}</span>{e.name}</a>)}
        </nav>

        <section className="lab-set" aria-labelledby="lab-rigs">
          <header className="lab-set-head"><h2 id="lab-rigs">Rigs</h2><p>직접 끌고, 누르고, 흔들어 보는 움직임 실험. 브라우저 안에서 바로 실행됩니다.</p></header>
          {rigs.map(e => <Sheet key={e.code} e={e} />)}
        </section>
        <section className="lab-set" aria-labelledby="lab-studies">
          <header className="lab-set-head"><h2 id="lab-studies">Studies</h2><p>프로젝트 안에서 따로 떼어 실험한 장치와 화면.</p></header>
          {studies.map(e => <Sheet key={e.code} e={e} />)}
        </section>
        <footer className="lab-foot"><span>Jaydne Laboratory</span><span>Experiments are added as they are made.</span></footer>
      </main>
    </SiteShell>
  );
}
