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
  id: string; name: string; branch?: 'solid' | 'dotted'; from?: string; rejoin?: string;
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
  { id: 'mockup', name: 'Working mockup', branch: 'solid', from: 'modeling', human: 'Rhino · Fusion · Arduino',
    aside: { ko: '손으로 만들고, 직접 움직여 보며 검증합니다', en: 'Built by hand, proven by moving it' },
    media: { src: '/projects/identity/motion/robot-arm.mp4', poster: '/projects/identity/motion/robot-arm.webp', video: true, to: '/project/portfolio/8', label: 'Identity Camouflager' } },
  { id: 'rigging', name: 'Rigging', human: 'Blender',
    ai: [{ tools: 'ChatGPT · Claude', ko: '초기 관절 세팅 및 physical 세팅', en: 'First joint set-up and physics settings' }],
    media: { src: '/projects/lab/miro-arm.mp4', poster: '/projects/lab/miro-arm-poster.webp', video: true, to: '/lab#EX-02', label: 'Lab · Miro arm' } },
  { id: 'motion', name: 'Motion', human: 'Blender',
    aside: { ko: '아직은 휴먼 터치가 더 낫다고 판단', en: 'Here the human touch is still better' },
    media: { src: '/projects/lab/horse.mp4', poster: '/projects/lab/horse.webp', video: true, to: '/lab#EX-03', label: 'Lab · Reckless' } },
  { id: 'abc', name: 'ABC file' },
  { id: 'still', name: 'Still image', branch: 'dotted', from: 'modeling', rejoin: 'rendering',
    media: { src: '/projects/lotty/hero.webp', to: '/project/portfolio/15', label: 'Lotty & Lorry' } },
  { id: 'rendering', name: 'Rendering', human: 'KeyShot · Blender',
    ai: [{ tools: 'ChatGPT · Claude', ko: '기존에 세팅한 재질을 자동화해서 입히는 과정에 사용', en: 'Applying materials I have already set up, automatically' }],
    media: { src: '/projects/miro/hero-plant.webp', to: '/projects', label: 'Miro' } },
  { id: 'edited', name: 'Image edited', branch: 'dotted', from: 'rendering', human: 'Photoshop · Illustrator',
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
  const rootRef = useRef<HTMLDivElement>(null), mainRef = useRef<SVGPathElement>(null), penRef = useRef<SVGCircleElement>(null);
  const [paths, setPaths] = useState<{ main: string; branches: Array<{ id: string; d: string; dotted: boolean }>; w: number; h: number }>({ main: '', branches: [], w: 0, h: 0 });

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
      const mains = steps.filter(s => !s.branch).map(s => at(s.id));
      const start = { x: mains[0].x, y: Math.max(0, mains[0].y - 150) };
      let main = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} ` + curve(start, mains[0], 0);
      mains.slice(1).forEach((p, i) => { main += ' ' + curve(mains[i], p, i + 1); });
      const branches = steps.filter(s => s.branch).flatMap((s, i) => {
        const a = at(s.from!), b = at(s.id), list = [{ id: s.id, d: `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} ` + curve(a, b, 20 + i), dotted: s.branch === 'dotted' }];
        if (s.rejoin) { const c = at(s.rejoin); list.push({ id: s.id, d: `M ${b.x.toFixed(1)} ${b.y.toFixed(1)} ` + curve(b, c, 30 + i), dotted: true }); }
        return list;
      });
      setPaths({ main, branches, w: box.width, h: box.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
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
      const drawn = still ? length : length * i / 399;
      path.style.strokeDashoffset = `${length - drawn}`;
      const tip = path.getPointAtLength(drawn);
      pen.setAttribute('cx', `${tip.x}`); pen.setAttribute('cy', `${tip.y}`);
      root.querySelectorAll<HTMLElement>('[data-step]').forEach(el => {
        const dot = el.querySelector('.ap-dot')!.getBoundingClientRect();
        if (still || dot.top < innerHeight * .7) el.classList.add('is-in');
        else if (dot.top > innerHeight * .82) el.classList.remove('is-in');   // the line has pulled back: sleep, to wake again
      });
      steps.filter(s => s.branch).forEach(s => {
        const on = root.querySelector(`[data-step="${s.id}"]`)?.classList.contains('is-in');
        root.querySelectorAll(`[data-branch="${s.id}"]`).forEach(b => b.classList.toggle('is-in', !!on));
      });
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, [paths]);

  let aiCount = 0, side = 0;
  return <SiteShell active="about">
    <main className="about-process">
      <header className="ap-hero" ref={heroRef}>
        <h1 aria-label="How I work">
          <span>How I</span> <span>work</span>
          <svg viewBox="0 0 600 60" preserveAspectRatio="none" aria-hidden="true"><path pathLength={1} d="M8 34 C70 12 120 50 190 30 S300 14 370 34 S500 50 592 22" /></svg>
        </h1>
        <p className="ap-lead">{t('디자인 프로세스는 손에서 시작해 손으로 끝납니다. AI는 그 사이, 필요한 자리에만 도구처럼 들어옵니다.',
          'The design process starts and ends in the hand. AI comes in between, as a tool, only where it is needed.')}</p>
        <ul className="ap-legend">
          <li><i className="is-line" />( Human touch )</li>
          <li><AiMark i={2} />( AI support )</li>
        </ul>
      </header>

      <div className="ap-flow" ref={rootRef}>
        <svg className="ap-lines" width={paths.w} height={paths.h} viewBox={`0 0 ${paths.w || 1} ${paths.h || 1}`} aria-hidden="true">
          {paths.branches.map((b, i) => <path key={i} d={b.d} data-branch={b.id} className={'ap-branch' + (b.dotted ? ' is-dotted' : '')} pathLength={b.dotted ? undefined : 1} />)}
          <path ref={mainRef} d={paths.main} className="ap-main" />
          <circle ref={penRef} r="7" className="ap-pen" />
        </svg>
        {steps.map(s => {
          const flip = s.branch ? side % 2 === 0 : side++ % 2 === 1;
          return <section key={s.id} data-step={s.id} className={'ap-step' + (s.branch ? ' is-branch' : '') + (flip ? ' is-flip' : '') + (!s.media && !s.ai ? ' is-small' : '')}>
            <div className="ap-copy">
              <h2 className="ap-pill">{s.name}</h2>
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
