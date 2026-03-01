import React, { useState, useEffect, useRef } from 'react';

// --- 픽셀 'O' SVG 컴포넌트 ---
const PixelO = () => (
  <svg viewBox="0 0 4 4" className="inline-block h-[0.75em] w-[0.75em] mx-[0.04em] fill-current -translate-y-[0.08em]">
    <rect x="1" y="0" width="2" height="1" />
    <rect x="0" y="1" width="1" height="2" />
    <rect x="3" y="1" width="1" height="2" />
    <rect x="1" y="3" width="2" height="1" />
  </svg>
);

// --- 인터랙티브 배경 그리드 (Canvas) ---
const GridTrail = () => {
  const canvasRef = useRef(null);
  const activeCells = useRef(new Map()); // "col,row" -> timestamp
  const lastPos = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let cellSize = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // 가로를 20등분하여 정사각형(Cell) 사이즈 결정
      cellSize = canvas.width / 20; 
    };
    
    window.addEventListener('resize', resize);
    resize();

    // 두 점 사이의 궤적을 촘촘히 계산하여 끊기지 않고 이어지게 만듦 (Bresenham 스타일 보간)
    const getCellsBetween = (x0, y0, x1, y1) => {
      const cells = [];
      const dist = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.ceil(dist / (cellSize / 4)); 
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        cells.push({ col: Math.floor(x / cellSize), row: Math.floor(y / cellSize) });
      }
      return cells;
    };

    const handleMouseMove = (e) => {
      const col = Math.floor(e.clientX / cellSize);
      const row = Math.floor(e.clientY / cellSize);

      if (lastPos.current) {
        const cells = getCellsBetween(lastPos.current.x, lastPos.current.y, e.clientX, e.clientY);
        cells.forEach(c => {
          activeCells.current.set(`${c.col},${c.row}`, Date.now());
        });
      } else {
        activeCells.current.set(`${col},${row}`, Date.now());
      }
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const rows = Math.ceil(canvas.height / cellSize);

      // 1. 옅은 배경 그리드(선) 그리기
      ctx.strokeStyle = 'rgba(17, 17, 17, 0.08)'; // 아주 옅은 검은색 선
      ctx.lineWidth = 1;
      for (let i = 0; i <= 20; i++) {
        ctx.beginPath(); ctx.moveTo(i * cellSize, 0); ctx.lineTo(i * cellSize, canvas.height); ctx.stroke();
      }
      for (let i = 0; i <= rows; i++) {
        ctx.beginPath(); ctx.moveTo(0, i * cellSize); ctx.lineTo(canvas.width, i * cellSize); ctx.stroke();
      }

      // 2. 마우스가 지나간 활성화된 블록 그리기
      const now = Date.now();
      const fadeDuration = 1200; // 블록이 서서히 사라지는 시간 (1.2초)

      activeCells.current.forEach((time, key) => {
        const age = now - time;
        if (age > fadeDuration) {
          activeCells.current.delete(key);
        } else {
          const [col, row] = key.split(',').map(Number);
          // 시간에 따라 투명도가 줄어드는 이펙트
          const opacity = 1 - (age / fadeDuration);
          ctx.fillStyle = `rgba(17, 17, 17, ${opacity})`;
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />;
};


// --- 메인 앱 컴포넌트 ---
export default function App() {
  const [appState, setAppState] = useState('initial'); 
  const [cursorState, setCursorState] = useState({ type: 'default', text: '' });
  const [sliderValue, setSliderValue] = useState(50);
  const cursorRef = useRef(null);
  const sliderTrackRef = useRef(null); // 선(트랙)의 물리적 위치를 계산하기 위한 Ref 추가

  // 애니메이션 시퀀스
  useEffect(() => {
    const t1 = setTimeout(() => setAppState('expanding'), 1800);
    const t2 = setTimeout(() => setAppState('splitting'), 2400);
    const t3 = setTimeout(() => setAppState('ready'), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // 전역 마우스 이동 처리
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%), 0)`;
      }
      if (appState === 'ready') {
        // 전체 화면 기준이 아닌, 실제 슬라이더 트랙의 길이를 기준으로 계산하도록 변경
        if (sliderTrackRef.current) {
          const rect = sliderTrackRef.current.getBoundingClientRect();
          let relativeX = e.clientX - rect.left;
          let percent = (relativeX / rect.width) * 100;
          
          // 트랙을 벗어나지 않도록 0% ~ 100% 사이로 고정
          percent = Math.max(0, Math.min(100, percent));
          setSliderValue(percent);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [appState]);

  const handleMenuHover = (text) => setCursorState({ type: 'text', text });
  const handleMenuLeave = () => setCursorState({ type: 'default', text: '' });

  return (
    <div className="relative w-screen h-screen bg-[#f7f6f0] overflow-hidden cursor-none selection:bg-[#111] selection:text-[#f7f6f0] font-sans flex flex-col">
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .animate-blink { animation: blink 1s step-end infinite; }
      `}} />

      {/* 0. 반응형 그리드 캔버스 (마우스 트레일) */}
      <GridTrail />

      {/* 1. 반응형 모핑 마우스 커서 */}
      {appState !== 'initial' && (
        <div 
          ref={cursorRef}
          className="fixed top-0 left-0 pointer-events-none z-50 flex items-center justify-center will-change-transform mix-blend-difference"
          style={{ transform: 'translate3d(-100px, -100px, 0)' }}
        >
          <div 
            className={`transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] flex items-center justify-center overflow-hidden
              ${cursorState.type === 'default' ? 'w-5 h-5 bg-[#f7f6f0]' : ''}
              ${cursorState.type === 'text' ? 'h-8 px-5 bg-[#f7f6f0] rounded-full' : ''}
              ${cursorState.type === 'slider' ? 'bg-transparent scale-110' : ''}
            `}
          >
            {cursorState.type === 'text' && (
              <span className="text-[#111] text-[10px] md:text-xs font-medium uppercase tracking-widest whitespace-nowrap">
                {cursorState.text}
              </span>
            )}
            
            {cursorState.type === 'slider' && (
              <div className="relative flex flex-col">
                <div className="flex">
                   <div className="w-8 h-8 bg-[#f7f6f0]"></div>
                   <div className="w-12 h-8 bg-[#f7f6f0] ml-1"></div>
                </div>
                <div className="w-8 h-12 bg-[#f7f6f0] mt-1 ml-6"></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 콘텐츠 영역: mix-blend-difference를 사용하여 
        검은색 그리드 위를 지날 때 글자가 반전되어 보이도록 처리 
      */}
      <div className="absolute inset-0 flex flex-col z-10 mix-blend-difference text-[#f7f6f0] pointer-events-none">
        
        {/* 네비게이션 */}
        <nav className={`absolute top-0 w-full flex justify-between items-center p-6 md:px-12 pointer-events-auto transition-opacity duration-1000 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
          <button onMouseEnter={() => handleMenuHover('Menu')} onMouseLeave={handleMenuLeave} className={`text-[10px] md:text-xs font-medium uppercase tracking-widest cursor-none transition-opacity duration-200 ${cursorState.text === 'Menu' ? 'opacity-0' : 'opacity-100'}`}>Menu</button>
          <button onMouseEnter={() => handleMenuHover('White Version')} onMouseLeave={handleMenuLeave} className={`text-[10px] md:text-xs font-medium uppercase tracking-widest cursor-none transition-opacity duration-200 ${cursorState.text === 'White Version' ? 'opacity-0' : 'opacity-100'}`}>White Version</button>
          <button onMouseEnter={() => handleMenuHover('Contact')} onMouseLeave={handleMenuLeave} className={`text-[10px] md:text-xs font-medium uppercase tracking-widest cursor-none transition-opacity duration-200 ${cursorState.text === 'Contact' ? 'opacity-0' : 'opacity-100'}`}>Contact</button>
        </nav>

        {/* Top Section */}
        <div className={`flex-1 flex items-center justify-center border-b border-[#f7f6f0]/30 transition-transform duration-[1200ms] ease-[cubic-bezier(0.85,0,0.15,1)] ${appState === 'initial' || appState === 'expanding' ? 'translate-y-[33vh]' : 'translate-y-0'}`}>
          <h1 className={`text-[11vw] font-medium tracking-tight leading-none transition-opacity duration-1000 delay-300 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
            L<PixelO/>renz<PixelO/> Dal D<PixelO/>ss<PixelO/>
          </h1>
        </div>

        {/* Middle Section (Slider) */}
        <div className={`flex-1 flex items-center justify-center px-6 md:px-16 transition-transform duration-[1200ms] ease-[cubic-bezier(0.85,0,0.15,1)] relative pointer-events-auto`}>
          
          {(appState === 'initial' || appState === 'expanding' || appState === 'splitting') && (
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-[#f7f6f0] flex items-center px-3 transition-all duration-[800ms] ease-[cubic-bezier(0.85,0,0.15,1)] ${
              appState === 'initial' ? 'w-24 h-10' :
              appState === 'expanding' ? 'w-[80vw] max-w-5xl h-10' :
              'w-[80vw] max-w-5xl h-[1px] border-transparent bg-[#f7f6f0]/30'
            }`}>
              {appState === 'initial' && <div className="w-3 h-5 bg-[#f7f6f0] animate-blink" />}
            </div>
          )}

          <div className="flex items-center justify-between w-full relative">
            <span className={`text-[7vw] md:text-[5vw] font-mono leading-none transition-opacity duration-1000 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
              {/* 번호가 더 정밀한 비율로 변경되도록 수식을 최적화했습니다 */}
              {`0${Math.min(4, Math.max(1, Math.floor(sliderValue / 25) + 1))}`}
            </span>

            <div 
              className="flex-1 max-w-5xl mx-8 md:mx-16 relative h-32 flex items-center cursor-none"
              onMouseEnter={() => setCursorState({ type: 'slider', text: '' })}
              onMouseLeave={handleMenuLeave}
            >
              <p className={`absolute top-2 left-1/2 -translate-x-1/2 w-full text-center text-[9px] uppercase tracking-widest transition-opacity duration-1000 delay-300 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
                Hello. I'm Mister Wolf. I solve Problems. Yes, I'm an IT Specialist.
              </p>

              {/* 트랙 영역에 ref를 연결합니다 */}
              <div ref={sliderTrackRef} className={`w-full h-[1px] bg-[#f7f6f0]/30 relative transition-opacity duration-1000 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
                <div 
                  className="absolute top-1/2 -translate-y-1/2 h-5 bg-[#f7f6f0] transition-transform duration-100 ease-out"
                  style={{ width: '25%', left: `${sliderValue}%`, transform: `translateX(-${sliderValue}%)` }}
                />
              </div>

              <div className={`absolute bottom-2 left-0 w-full flex justify-between px-4 md:px-12 text-[9px] uppercase tracking-widest transition-opacity duration-1000 delay-300 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
                <span>Move</span><span>Cursor</span><span>To Draw</span>
              </div>
            </div>

            {/* 레이아웃 중앙 정렬 밸런스를 유지하기 위해 우측 요소는 공간만 차지하고 보이지 않게(invisible) 처리합니다 */}
            <span className={`text-[7vw] md:text-[5vw] font-mono leading-none invisible`}>04</span>
          </div>
        </div>

        {/* Bottom Section (Marquee) */}
        <div className={`flex-1 border-t border-[#f7f6f0]/30 flex items-center overflow-hidden transition-transform duration-[1200ms] ease-[cubic-bezier(0.85,0,0.15,1)] ${appState === 'initial' || appState === 'expanding' ? '-translate-y-[33vh]' : 'translate-y-0'}`}>
          <div className={`flex whitespace-nowrap transition-transform duration-75 ease-out`} style={{ transform: `translateX(calc(-${sliderValue * 0.4}% - 5%))` }}>
            <h2 className={`text-[11vw] font-medium tracking-tight px-8 transition-opacity duration-1000 delay-300 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
              Security <span className="mx-6 md:mx-12 font-light text-[#f7f6f0]/40">·</span> Supp<PixelO/>rt <span className="mx-6 md:mx-12 font-light text-[#f7f6f0]/40">·</span> Netw<PixelO/>rk
            </h2>
          </div>
        </div>

      </div>
    </div>
  );
}