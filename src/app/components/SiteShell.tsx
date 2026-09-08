import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

type ActivePage = 'space' | 'projects' | 'about';
const items: Array<{ key: ActivePage; label: string; index: string; to: string }> = [
  { key: 'space', label: 'Space', index: '1', to: '/' },
  { key: 'projects', label: 'Projects', index: '2', to: '/projects' },
  { key: 'about', label: 'About', index: '3', to: '/about' },
];
const typedLabels = new Set<ActivePage>();
const typingCadence = [82, 148, 66, 116, 91, 164, 74, 132];

function TypingTab({ item, active }: { item: typeof items[number]; active: boolean }) {
  const [text, setText] = useState(typedLabels.has(item.key) ? item.label : '');
  const typingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const typeLabel = useCallback(() => {
    if (typingRef.current || typedLabels.has(item.key)) { setText(item.label); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      typedLabels.add(item.key); setText(item.label); return;
    }
    typingRef.current = true;
    let character = 0;
    const typeNext = () => {
      character += 1;
      setText(item.label.slice(0, character));
      if (character < item.label.length) timerRef.current = window.setTimeout(typeNext, typingCadence[(character - 1) % typingCadence.length]);
      else { typedLabels.add(item.key); typingRef.current = false; timerRef.current = null; }
    };
    timerRef.current = window.setTimeout(typeNext, 90);
  }, [item.key, item.label]);
  useEffect(() => { if (active) typeLabel(); return () => { if (timerRef.current) window.clearTimeout(timerRef.current); }; }, [active, typeLabel]);
  return <Link to={item.to} className={'editorial-tab ' + (active ? 'is-active' : '')} aria-label={item.label} aria-keyshortcuts={item.index} aria-current={active ? 'page' : undefined} onMouseEnter={typeLabel} onFocus={typeLabel}>
    <span className="editorial-tab-label"><span>{text}</span><span className="editorial-tab-caret" aria-hidden="true">|</span></span>
  </Link>;
}

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
          {items.map(item => <TypingTab key={item.key} item={item} active={active === item.key} />)}
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

