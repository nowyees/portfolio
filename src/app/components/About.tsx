import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import SiteShell from './SiteShell';
import ContactDialog from './ContactDialog';

export default function About() {
  const [contactOpen, setContactOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [location.hash]);

  return <SiteShell active="about">
    <main className="about-page">
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

