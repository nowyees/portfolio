import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

type ActivePage = 'space' | 'projects' | 'about';
const items: Array<{ key: ActivePage; label: string; index: string; to: string }> = [
  { key: 'space', label: 'Creative Space', index: '1', to: '/' },
  { key: 'projects', label: 'Projects', index: '2', to: '/projects' },
  { key: 'about', label: 'About', index: '3', to: '/about' },
];
let soundEnabled = false;
let audioContext: AudioContext | null = null;
function playClick() {
  if (!soundEnabled) return;
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    const tone = audioContext.createOscillator(), gain = audioContext.createGain();
    tone.type = 'sine'; tone.frequency.setValueAtTime(660, audioContext.currentTime);
    tone.frequency.exponentialRampToValueAtTime(330, audioContext.currentTime + .09);
    gain.gain.setValueAtTime(.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + .12);
    tone.connect(gain); gain.connect(audioContext.destination); tone.start(); tone.stop(audioContext.currentTime + .13);
  } catch { /* Sound is optional when browser audio is unavailable. */ }
}

export default function SiteShell({ active, children }: { active: ActivePage; children: React.ReactNode }) {
  const location = useLocation(), navigate = useNavigate();
  const [soundOn, setSoundOn] = useState(soundEnabled);
  useEffect(() => {
    document.title = (active === 'space' ? 'Creative Space' : active === 'projects' ? 'Projects' : 'About') + ' — Lee Jae Woong';
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]') || event.metaKey || event.ctrlKey || event.altKey) return;
      const item = items.find(item => item.index === event.key);
      if (item) navigate(item.to);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [active, navigate]);
  return <div className="editorial-site" onClick={event => { if ((event.target as HTMLElement).closest('a, button')) playClick(); }}>
    <a href="#page-content" className="skip-link">Skip to content</a>
    <header className="editorial-nav">
      <div className="editorial-nav-center">
        <Link to="/" className="editorial-brand" aria-label="Lee Jae Woong — home">LJ .W</Link>
        <nav aria-label="Main">
          {items.map(item => <Link key={item.key} to={item.to} className={'editorial-tab ' + (active === item.key ? 'is-active' : '')} aria-label={item.label + ' ' + item.index} aria-current={active === item.key ? 'page' : undefined}>
            <span className="editorial-tab-label">{item.label}</span><sup>{item.index}</sup>
          </Link>)}
        </nav>
      </div>
      <button type="button" className={'editorial-sound ' + (soundOn ? 'is-on' : '')} aria-label={soundOn ? 'Turn off sound' : 'Turn on sound'} aria-pressed={soundOn}
        onClick={() => { soundEnabled = !soundEnabled; setSoundOn(soundEnabled); }}>
        <span aria-hidden="true" />
      </button>
    </header>
    <div id="page-content" key={location.pathname} className="page-enter">{children}</div>
  </div>;
}
