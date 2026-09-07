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
    let frame = 0, current = 0, target = 0;
    let pointerX = Infinity, pointerY = Infinity, repelX = 0, repelY = 0;
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
      const centerX = innerWidth * .5 + x, centerY = innerHeight * .52 - bounce;
      const dx = centerX - pointerX, dy = centerY - pointerY;
      const distance = Math.hypot(dx, dy);
      const range = Math.min(240, Math.max(150, object.offsetWidth * 1.35));
      let repelTargetX = 0, repelTargetY = 0;
      if (!reduced.matches && Number.isFinite(distance) && distance < range) {
        const force = Math.pow(1 - distance / range, 2) * Math.min(155, innerWidth * .28);
        repelTargetX = (distance > 1 ? dx / distance : -1) * force;
        repelTargetY = (distance > 1 ? dy / distance : -.35) * force;
      }
      repelX += (repelTargetX - repelX) * .16;
      repelY += (repelTargetY - repelY) * .16;
      const radius = object.offsetWidth * .5;
      const movedX = Math.max(-innerWidth * .5 + radius + 14, Math.min(innerWidth * .5 - radius - 14, x + repelX));
      const movedY = Math.max(-innerHeight * .52 + radius + 62, Math.min(innerHeight * .48 - radius - 14, -bounce + repelY));
      object.style.transform = 'translate(-50%, -50%) translate3d(' + movedX + 'px,' + movedY + 'px,0) scale(' + scaleX + ',' + scaleY + ')';
      if (Math.abs(target - current) > .0001 || Math.abs(repelTargetX - repelX) > .15 || Math.abs(repelTargetY - repelY) > .15) frame = requestAnimationFrame(draw);
    };
    const updateTarget = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      target = Math.max(0, Math.min(1, scrollY / maxScroll));
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const avoidPointer = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const releasePointer = () => {
      pointerX = Infinity;
      pointerY = Infinity;
      if (!frame) frame = requestAnimationFrame(draw);
    };
    updateTarget();
    window.addEventListener('scroll', updateTarget, { passive: true });
    window.addEventListener('resize', updateTarget);
    window.addEventListener('pointermove', avoidPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', releasePointer);
    reduced.addEventListener('change', updateTarget);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateTarget);
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('pointermove', avoidPointer);
      document.documentElement.removeEventListener('pointerleave', releasePointer);
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
