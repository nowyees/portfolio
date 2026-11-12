import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import SiteShell from './SiteShell';
import ContactDialog from './ContactDialog';
import { useLang } from '../../lib/i18n';
import '../../styles/about.css';

// ABOUT: the design process as one hand-drawn line (after the owner's "AI Process" slide). The black line is the
// human work, from ideation to a working mock-up, a film, a still or an interactive web; where AI steps in as a tool,
// a pale shape lands on the line. The line draws itself as the page scrolls.
type Step = {
  id: string; name: string;
  human?: string;                                   // the tools in hand
  ai?: { tools: string; ko: string; en: string }[]; // where AI comes in, and for what
  aside?: { ko: string; en: string };               // a remark where AI stays out
  media?: { src: string; poster?: string; video?: boolean; to: string; label: string };
};
const steps: Step[] = [
  { id: 'ideation', name: 'Ideation',
    ai: [{ tools: 'ChatGPT · Claude · Midjourney', ko: '생각을 넓히고 방향을 빠르게 그려보는 데 사용', en: 'To widen the thinking and sketch directions quickly' }],
    media: { src: '/projects/miro/ddp/studio-desk.webp', to: '/projects', label: 'Miro' } },
  { id: 'modeling', name: '3D modeling', human: 'Rhino · Fusion · Blender',
    ai: [{ tools: 'ChatGPT · Claude', ko: '반복 작업 및 프로그램끼리의 모델 추출 자동화', en: 'Automating repetitive work and moving models between programs' },
      { tools: 'Generative 3D', ko: '생성형 3D 모델을 통한 빠른 시각화', en: 'Quick visualisation with generated 3D models' }],
    media: { src: '/projects/miro/ddp/modeling.webp', to: '/projects', label: 'Miro' } },
  { id: 'mockup', name: 'Working mockup', human: 'Rhino · Fusion · Arduino',
    aside: { ko: '손으로 만들고, 직접 움직여 보며 검증합니다', en: 'Built by hand, proven by moving it' },
    media: { src: '/projects/identity/motion/robot-arm.mp4', poster: '/projects/identity/motion/robot-arm.webp', video: true, to: '/project/portfolio/8', label: 'Identity Camouflager' } },
  { id: 'rigging', name: 'Rigging', human: 'Blender',
    ai: [{ tools: 'ChatGPT · Claude', ko: '초기 관절 세팅 및 physical 세팅', en: 'First joint set-up and physics settings' }],
    media: { src: '/projects/lab/miro-arm.mp4', poster: '/projects/lab/miro-arm-poster.webp', video: true, to: '/lab#EX-02', label: 'Lab · Miro arm' } },
  { id: 'motion', name: 'Motion', human: 'Blender',
    aside: { ko: '아직은 휴먼 터치가 더 낫다고 판단', en: 'Here the human touch is still better' },
    media: { src: '/projects/lab/horse.mp4', poster: '/projects/lab/horse.webp', video: true, to: '/lab#EX-03', label: 'Lab · Reckless' } },
  { id: 'rendering', name: 'Rendering', human: 'KeyShot · Blender',
    ai: [{ tools: 'ChatGPT · Claude', ko: '기존에 세팅한 재질을 자동화해서 입히는 과정에 사용', en: 'Applying materials I have already set up, automatically' }],
    media: { src: '/projects/miro/hero-plant.webp', to: '/projects', label: 'Miro' } },
  { id: 'edited', name: 'Image editing', human: 'Photoshop · Illustrator',
    ai: [{ tools: 'Midjourney · Firefly · Gemini', ko: '합성된 이미지를 만들기 위해 사용', en: 'For making composited images' }],
    media: { src: '/projects/lunaris/cover.webp', to: '/project/portfolio/4', label: 'Lunaris' } },
  { id: 'video', name: 'Video editing', human: 'After Effects · Premiere',
    ai: [{ tools: 'Google Flow · Gemini', ko: '비디오 합성이나 필요한 영상 데이터 생성', en: 'Compositing video and generating the footage it needs' }],
    media: { src: '/projects/miro/motion/scenario-film.mp4', poster: '/projects/miro/motion/scenario-film.webp', video: true, to: '/projects', label: 'Miro' } },
  { id: 'web', name: 'Web building', human: 'Git',
    ai: [{ tools: 'ChatGPT · Claude', ko: '인터랙션 웹 빌딩이나 구현', en: 'Building and implementing interactive web' }],
    media: { src: '/projects/lab/robot-cell.mp4', poster: '/projects/lab/robot-cell.webp', video: true, to: '/lab#EX-05', label: 'Lab · Robot cell' } },
];

// The pale shapes AI arrives as (after Claude's own cut-paper shapes): triangle, square, circle, diamond.
const shapes = [
  'M50 6 C58 20 84 62 94 88 C70 92 28 92 6 88 C18 62 42 20 50 6 Z',
  'M10 12 C36 8 66 9 90 11 C93 36 92 64 90 90 C64 93 34 92 10 90 C8 64 8 38 10 12 Z',
  'M50 6 C76 6 94 26 94 50 C94 76 74 94 50 94 C24 94 6 76 6 50 C6 24 24 6 50 6 Z',
  'M50 4 C62 18 82 38 96 50 C82 62 62 82 50 96 C38 82 18 62 4 50 C18 38 38 18 50 4 Z',
];
const AiMark = ({ i }: { i: number }) => <svg className="ap-shape" viewBox="0 0 100 100" aria-hidden="true"><path d={shapes[i % shapes.length]} /></svg>;

function Media({ media, name }: { media: NonNullable<Step['media']>; name: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) video.play().catch(() => {}); else video.pause(); }, { threshold: .25 });
    io.observe(video);
    return () => io.disconnect();
  }, []);
  return <Link className="ap-work" to={media.to} aria-label={name + ' — ' + media.label}>
    {media.video ? <video ref={ref} src={media.src} poster={media.poster} muted loop playsInline preload="metadata" />
      : <img src={media.src} alt="" loading="lazy" />}
    <span>{media.label} →</span>
  </Link>;
}

// A wobbly hand-drawn curve between two points: mostly vertical, easing sideways, never quite straight.
const wobble = (i: number, k: number) => Math.sin(i * 12.9898 + k * 78.233) * (innerWidth < 760 ? 8 : 46);
const curve = (a: { x: number; y: number }, b: { x: number; y: number }, i: number) => {
  const dy = b.y - a.y;
  return `C ${(a.x + wobble(i, 1)).toFixed(1)} ${(a.y + dy * .45).toFixed(1)}, ${(b.x + wobble(i, 2)).toFixed(1)} ${(b.y - dy * .45).toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
};

export default function About() {
  const [contactOpen, setContactOpen] = useState(false);
  const location = useLocation(), lang = useLang();
  const t = (ko: string, en: string) => lang === 'ko' ? ko : en;
  const heroRef = useRef<HTMLElement>(null);
  // the title writes itself in each time it comes back into view
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => el.classList.toggle('is-in', entry.isIntersecting), { threshold: .35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const rootRef = useRef<HTMLDivElement>(null), mainRef = useRef<SVGPathElement>(null), penRef = useRef<SVGGElement>(null);
  const [paths, setPaths] = useState({ main: '', w: 0, h: 0 });

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [location.hash]);

  // Lay the line through the dots of the steps, wherever the layout has put them.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const box = root.getBoundingClientRect();
      const at = (id: string) => {
        const r = root.querySelector<HTMLElement>(`[data-step="${id}"] .ap-dot`)!.getBoundingClientRect();
        return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
      };
      const mains = steps.map(s => at(s.id));
      // the line leaves from the end of the stroke under the title, where the hand has hold of it
      const g = root.querySelector<HTMLElement>('.ap-grab')!.getBoundingClientRect();
      const start = { x: g.left - box.left, y: g.top - box.top }, last = mains[mains.length - 1];
      // it runs on past the title, curls once into a small loop and drops
      const k = innerWidth < 760 ? .5 : 1, n = (v: number) => (v * k).toFixed(1);
      const loop = `c ${n(60)} ${n(6)} ${n(84)} ${n(24)} ${n(80)} ${n(58)} c ${n(-3)} ${n(28)} ${n(-58)} ${n(30)} ${n(-58)} ${n(8)} c 0 ${n(-20)} ${n(44)} ${n(-16)} ${n(50)} ${n(12)} c ${n(5)} ${n(22)} ${n(4)} ${n(40)} ${n(4)} ${n(62)}`;
      const drop = { x: start.x + 76 * k, y: start.y + 140 * k };
      let main = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} ${loop} ` + curve(drop, mains[0], 0);
      mains.slice(1).forEach((p, i) => { main += ' ' + curve(mains[i], p, i + 1); });
      main += ' ' + curve(last, { x: last.x, y: Math.min(box.height - 30, last.y + 300) }, 40);
      setPaths({ main, w: box.width, h: box.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(root.querySelector('.ap-hero h1')!);   // the title changes size when its font arrives
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [lang]);

  // The line is drawn as far as the middle of the screen; steps and branches wake as it reaches them.
  useEffect(() => {
    const root = rootRef.current, path = mainRef.current, pen = penRef.current;
    if (!root || !path || !pen || !paths.main) return;
    const length = path.getTotalLength(), still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const samples = Array.from({ length: 400 }, (_, i) => path.getPointAtLength(length * i / 399).y);
    path.style.strokeDasharray = `${length}`;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = root.getBoundingClientRect().top, target = innerHeight * .62 - top;
      let i = 0; while (i < 399 && samples[i] < target) i++;
      const drawn = still ? length : Math.min(length * i / 399, scrollY * 3);   // nothing is pulled out until the page moves
      path.style.strokeDashoffset = `${length - drawn}`;
      // the hand holds the end of the line and leans the way it is pulling
      const tip = path.getPointAtLength(drawn), back = path.getPointAtLength(Math.max(0, drawn - 40));
      const lean = drawn > 240 ? Math.max(-28, Math.min(28, Math.atan2(tip.x - back.x, tip.y - back.y) * 180 / Math.PI * -.7)) : 0;
      pen.setAttribute('transform', `translate(${tip.x.toFixed(1)} ${tip.y.toFixed(1)})`);
      pen.firstElementChild!.setAttribute('transform', `rotate(${lean.toFixed(1)})`);
      root.classList.toggle('is-pulled', scrollY > 24);
      root.querySelectorAll<HTMLElement>('[data-step]').forEach(el => {
        const dot = el.querySelector('.ap-dot')!.getBoundingClientRect();
        if (still || dot.top < innerHeight * .7) el.classList.add('is-in');
        else if (dot.top > innerHeight * .82) el.classList.remove('is-in');   // the line has pulled back: sleep, to wake again
      });
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, [paths]);

  let aiCount = 0;
  return <SiteShell active="about">
    <main className="about-process">
      <div className="ap-flow" ref={rootRef}>
        <header className="ap-hero" ref={heroRef}>
          <h1 aria-label="How I work">
            <span>How I</span> <span>work</span>
            <svg viewBox="0 0 600 60" preserveAspectRatio="none" aria-hidden="true"><path d="M8 34 C70 12 120 50 190 30 S270 15 300 22" /></svg>
            <i className="ap-grab" aria-hidden="true" />
          </h1>
        </header>
        <svg className="ap-lines" width={paths.w} height={paths.h} viewBox={`0 0 ${paths.w || 1} ${paths.h || 1}`} aria-hidden="true">
          <path ref={mainRef} d={paths.main} className="ap-main" />
          <g ref={penRef} className="ap-hand"><g><g className="ap-hand-art">
            <path className="is-fill" d="M2 2 C2 -14 16 -26 32 -22 L60 -40 L128 -4 L128 62 L74 66 C50 60 28 40 14 22 Z" />
            <path d="M128 4 C108 -28 74 -44 50 -36 C30 -28 12 -14 2 0" />
            <path d="M2 2 C8 14 22 20 34 12 C42 6 44 -4 40 -14" />
            <path d="M40 -14 C52 -8 58 6 54 20 C50 34 38 44 24 44" />
            <path d="M54 14 C68 18 74 32 68 46 C62 58 50 64 38 62" />
            <path d="M68 40 C80 44 84 56 78 66 C72 76 60 78 52 74" />
            <path d="M78 66 C94 70 112 68 128 58" />
          </g></g><text className="ap-pull" x="-30" y="112">scroll to pull ↓</text></g>
        </svg>
        {steps.map((s, n) => {
          return <section key={s.id} data-step={s.id} className={'ap-step' + (n % 2 ? ' is-flip' : '')}>
            <div className="ap-copy">
              <h2 className="ap-pill"><small aria-hidden="true">{String(n + 1).padStart(2, '0')}</small>{s.name}</h2>
              {s.human && <p className="ap-human"><span>( Human touch )</span>{s.human}</p>}
              {s.ai?.map(a => <div className="ap-ai" key={a.tools}>
                <AiMark i={aiCount++} />
                <p><span>( AI support )</span><b>{a.tools}</b>{t(a.ko, a.en)}</p>
              </div>)}
              {s.aside && <p className="ap-aside">{t(s.aside.ko, s.aside.en)}</p>}
            </div>
            <i className="ap-dot" aria-hidden="true" />
            <div className="ap-media">{s.media && <Media media={s.media} name={s.name} />}</div>
          </section>;
        })}
      </div>

      <section id="contact" className="ap-end">
        <h2>{t('여기까지가 제가 일하는 방식입니다.', 'That is how I work.')}</h2>
        <div className="ap-end-grid">
          <div><h3>Contact</h3><a href="mailto:ljwoong1104@gmail.com">ljwoong1104@gmail.com</a><a href="https://instagram.com/now_y_es" target="_blank" rel="noopener noreferrer">Instagram ↗︎</a><a href="tel:010-2380-9280">010-2380-9280</a></div>
          <div><h3>Selected Press</h3><a href="https://www.dezeen.com/2025/12/15/wearable-device-for-sensory-problems-among-projects-from-hongik-university/" target="_blank" rel="noopener noreferrer">Dezeen 2025 — Lunaris ↗︎</a></div>
          <div><h3>Lee Jae Woong</h3><p>Design Engineer</p><p>Product · Robotics · Interactive web</p></div>
        </div>
        <footer className="ap-foot"><Link to="/">Jaydne. Studio</Link>
          <button type="button" onClick={() => setContactOpen(true)}>Contact / Admin ↗︎</button>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top ↑︎</button></footer>
      </section>
    </main>
    <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} dark={false} />
  </SiteShell>;
}
