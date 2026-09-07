import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import SiteShell from './SiteShell';
import ContactDialog from './ContactDialog';

export default function About() {
  const [contactOpen, setContactOpen] = useState(false);
  const objectRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
    const object = objectRef.current;
    if (!object) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, current = 0;
    let target = 0;
    const draw = () => {
      frame = 0;
      current += (target - current) * .11;
      const phase = current * Math.PI * 8;
      const travel = Math.min(innerWidth * .25, 300);
      const x = reduced.matches ? 0 : Math.sin(current * Math.PI * 2.35) * travel;
      const bounce = reduced.matches ? 0 : Math.abs(Math.sin(phase)) * Math.min(innerHeight * .1, 88);
      const landing = reduced.matches ? 0 : Math.pow(Math.abs(Math.cos(phase)), 14) * Math.sin(current * Math.PI);
      const scaleX = 1 + landing * .055;
      const scaleY = 1 - landing * .045;
      object.style.transform = 'translate(-50%, -50%) translate3d(' + x + 'px,' + -bounce + 'px,0) scale(' + scaleX + ',' + scaleY + ')';
      if (Math.abs(target - current) > .0001) frame = requestAnimationFrame(draw);
    };
    const updateTarget = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      target = Math.max(0, Math.min(1, scrollY / maxScroll));
      if (!frame) frame = requestAnimationFrame(draw);
    };
    updateTarget();
    window.addEventListener('scroll', updateTarget, { passive: true });
    window.addEventListener('resize', updateTarget);
    reduced.addEventListener('change', updateTarget);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateTarget);
      window.removeEventListener('resize', updateTarget);
      reduced.removeEventListener('change', updateTarget);
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
      <section id="contact" className="about-contact-section">
        <div className="about-press"><h2>Selected Press</h2><a href="https://www.dezeen.com/2025/12/15/wearable-device-for-sensory-problems-among-projects-from-hongik-university/" target="_blank" rel="noopener noreferrer">Dezeen <sup>2025</sup></a><p>LUNARIS</p></div>
        <div className="about-contact"><h2>Contact</h2><a href="mailto:ljwoong1104@gmail.com">ljwoong1104@gmail.com</a><a href="https://instagram.com/now_y_es" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="tel:010-2380-9280">010-2380-9280</a><button type="button" onClick={() => setContactOpen(true)}>Contact / Admin ↗</button></div>
      </section>
      <footer className="about-bottom"><Link to="/">LJ .W</Link><span>Lee Jae Woong</span><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top ↑</button></footer>
    </main>
    <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} dark={false} />
  </SiteShell>;
}
