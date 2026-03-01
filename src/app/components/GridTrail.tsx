import React, { useEffect, useRef } from 'react';

interface GridTrailProps {
  dark: boolean;
  sliderValue?: number;
  sliderTrackRef?: React.RefObject<HTMLDivElement | null>;
  ready?: boolean;
  labelRefs?: React.RefObject<(HTMLButtonElement | null)[]>;
  appState?: string;
  overlay?: boolean;
}

const GridTrail: React.FC<GridTrailProps> = ({ dark, sliderValue = 0, sliderTrackRef, ready = true, labelRefs, appState = 'ready', overlay = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailQueue = useRef<{ col: number; row: number; time: number }[]>([]);
  const lastCell = useRef<string>('');
  const darkRef = useRef(dark);
  darkRef.current = dark;
  const sliderRef = useRef({ value: sliderValue, ready });
  sliderRef.current = { value: sliderValue, ready };
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  // 세포 분열 애니메이션 상태
  const blobAnim = useRef({ prevIndex: -1, currIndex: -1, startTime: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationFrameId: number;
    let cellSize = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cellSize = canvas.width / 20;
    };

    window.addEventListener('resize', resize);
    resize();

    const handleMouseMove = (e: MouseEvent) => {
      const col = Math.floor(e.clientX / cellSize);
      const row = Math.floor(e.clientY / cellSize);
      const key = `${col},${row}`;

      if (key !== lastCell.current) {
        lastCell.current = key;
        trailQueue.current.push({ col, row, time: Date.now() });
        if (trailQueue.current.length > 4) {
          trailQueue.current.shift();
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (cellSize === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const now = Date.now();
      const fadeDuration = 1200;

      // --- 로딩 페이즈: 화면 중앙에 천천히 깜빡이는 메타볼 원 ---
      if (appStateRef.current !== 'ready') {
        const fc = darkRef.current ? '238, 238, 224' : '17, 17, 17';
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const breathe = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now / 1500 * Math.PI - Math.PI / 2));
        const baseR = 30;

        const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseR);
        grad.addColorStop(0, `rgba(${fc}, ${breathe})`);
        grad.addColorStop(0.6, `rgba(${fc}, ${breathe})`);
        grad.addColorStop(0.85, `rgba(${fc}, ${breathe * 0.6})`);
        grad.addColorStop(1, `rgba(${fc}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(centerX - baseR, centerY - baseR, baseR * 2, baseR * 2);

        animationFrameId = requestAnimationFrame(render);
        return;
      }

      trailQueue.current = trailQueue.current.filter(cell => {
        const age = now - cell.time;
        if (age > fadeDuration) return false;
        const opacity = 1 - age / fadeDuration;
        const cx = cell.col * cellSize + cellSize / 2;
        const cy = cell.row * cellSize + cellSize / 2;
        const r = cellSize * 0.65;
        const fc = darkRef.current ? '238, 238, 224' : '17, 17, 17';

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `rgba(${fc}, ${opacity})`);
        grad.addColorStop(0.6, `rgba(${fc}, ${opacity * 0.7})`);
        grad.addColorStop(1, `rgba(${fc}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        return true;
      });

      // --- 슬라이더 바 (메타볼 효과 공유) ---
      if (sliderRef.current.ready && sliderTrackRef?.current && labelRefs?.current) {
        const trackRect = sliderTrackRef.current.getBoundingClientRect();
        const fc = darkRef.current ? '238, 238, 224' : '17, 17, 17';

        const labels = labelRefs.current;
        const labelCenters: number[] = [];
        for (let i = 0; i < 4; i++) {
          const btn = labels ? labels[i] : null;
          if (btn) {
            const r = btn.getBoundingClientRect();
            labelCenters.push(r.left + r.width / 2);
          }
        }

        if (labelCenters.length === 4) {
          const cy = trackRect.top + trackRect.height / 2;
          const currentIndex = Math.min(3, Math.max(0, Math.round((sliderRef.current.value - 12.5) / 25)));
          const anim = blobAnim.current;

          if (anim.currIndex !== currentIndex) {
            anim.prevIndex = anim.currIndex;
            anim.currIndex = currentIndex;
            anim.startTime = now;
          }

          const animDuration = 500;
          const elapsed = now - anim.startTime;
          const progress = Math.min(1, elapsed / animDuration);
          const ease = 1 - Math.pow(1 - progress, 3);

          const targetCx = labelCenters[currentIndex];
          const baseR = 30;

          const drawBlob = (bx: number, by: number, br: number) => {
            if (br < 1) return;
            const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
            grad.addColorStop(0, `rgba(${fc}, 1)`);
            grad.addColorStop(0.6, `rgba(${fc}, 1)`);
            grad.addColorStop(0.85, `rgba(${fc}, 0.6)`);
            grad.addColorStop(1, `rgba(${fc}, 0)`);
            ctx.fillStyle = grad;
            ctx.fillRect(bx - br, by - br, br * 2, br * 2);
          };

          if (anim.prevIndex >= 0 && anim.prevIndex < 4 && progress < 1) {
            const prevCx = labelCenters[anim.prevIndex];
            const shrinkR = baseR * (1 - ease);
            const growR = baseR * ease;
            drawBlob(prevCx, cy, shrinkR);
            drawBlob(targetCx, cy, growR);
          } else {
            drawBlob(targetCx, cy, baseR);
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 pointer-events-none ${overlay ? 'z-[60]' : 'z-0'}`}
      style={{
        filter: 'contrast(16)',
        backgroundColor: dark ? '#111' : '#f7f6f0',
        transition: 'background-color 0.6s ease',
        ...(overlay ? { mixBlendMode: dark ? 'screen' : 'multiply' } : {}),
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full" style={{ filter: 'blur(14px)' }} />
    </div>
  );
};

export default GridTrail;