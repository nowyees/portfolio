import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import SiteShell from './SiteShell';
import ContactDialog from './ContactDialog';
import { usePortfolio } from '../../lib/usePortfolio';

const chapters = [
  { title: 'Form', ids: [5, 7] },
  { title: 'Feel', ids: [11, 9] },
  { title: 'Purpose', ids: [12, 4] },
  { title: 'Story', ids: [8, 1] },
];
export default function About() {
  const projects = usePortfolio();
  const [contactOpen, setContactOpen] = useState(false);
  const objectRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
    const object = objectRef.current;
    if (!object) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const contact = document.getElementById('contact');
    const paint = () => {
      frame = 0;
      const progress = scrollY / innerHeight;
      const atContact = contact?.getBoundingClientRect().top ?? Infinity;
      const scale = reduced.matches ? 1 : 1 - Math.max(0, Math.min(1, progress)) * .18;
      object.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
      object.style.opacity = String(Math.max(0, Math.min(1, (atContact - innerHeight * .15) / (innerHeight * .6))));
    };
    const schedulePaint = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', schedulePaint, { passive: true });
    window.addEventListener('resize', schedulePaint);
    reduced.addEventListener('change', schedulePaint);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedulePaint);
      window.removeEventListener('resize', schedulePaint);
      reduced.removeEventListener('change', schedulePaint);
    };
  }, [location.hash]);

  return <SiteShell active="about">
    <main className="about-page">
      <div className="about-object" ref={objectRef} aria-hidden="true" />
      <section className="about-opening">
        <h1>Exploring the space between<br />objects, people and the<br />stories that connect them.</h1>
        <p>Lee Jae Woong — Design Engineer</p>
      </section>
      <section className="about-disciplines" aria-label="Design disciplines">
        <div><h2>Product Design</h2><p>Objects<br />Robotics<br />Wearable Devices<br />Design Engineering</p></div>
        <div><h2>Visual Exploration</h2><p>Image Making<br />3D Design<br />Speculative Design<br />Fashion &amp; Space</p></div>
      </section>
      {chapters.map(chapter => <section className="about-chapter" key={chapter.title}>
        <header><h2>{chapter.title}</h2></header>
        <div className="chapter-body">
          {chapter.ids.map(id => {
            const project = projects.find(p => p.id === id);
            return project && <div className="chapter-copy" key={id}><Link to={'/project/' + project.category + '/' + project.id}>{project.title} ↗</Link><p lang="ko">{project.desc}</p></div>;
          })}
        </div>
      </section>)}
      <section id="contact" className="about-contact-section">
        <div className="about-press"><h2>Selected Press</h2><a href="https://www.dezeen.com/2025/12/15/wearable-device-for-sensory-problems-among-projects-from-hongik-university/" target="_blank" rel="noopener noreferrer">Dezeen <sup>2025</sup></a><p>LUNARIS</p></div>
        <div className="about-contact"><h2>Contact</h2><a href="mailto:ljwoong1104@gmail.com">ljwoong1104@gmail.com</a><a href="https://instagram.com/now_y_es" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="tel:010-2380-9280">010-2380-9280</a><button type="button" onClick={() => setContactOpen(true)}>Contact / Admin ↗</button></div>
      </section>
      <footer className="about-bottom"><Link to="/">LJ .W</Link><span>Lee Jae Woong</span><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top ↑</button></footer>
    </main>
    <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} dark={false} />
  </SiteShell>;
}
