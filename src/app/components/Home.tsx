import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import GridTrail from './GridTrail';
import ContactDialog from './ContactDialog';
import '../../lib/seedData'; // window.__seedFirestore 등록

// --- 단어 목록 ---
const WORDS = ['FASHION', 'PRODUCT', 'SPACE', 'SPECULATIVE'];

// 최초 방문 여부를 세션 단위로 추적
let hasVisitedHome = false;

// --- 홈 컴포넌트 ---
export default function Home() {
  const navigate = useNavigate();
  const [appState, setAppState] = useState(() => hasVisitedHome ? 'ready' : 'initial');
  const [cursorState, setCursorState] = useState<{ type: string; text: string }>({ type: 'default', text: '' });
  const [sliderValue, setSliderValue] = useState(50);
  const [currentWord, setCurrentWord] = useState('SPACE');
  const [darkMode, setDarkMode] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 랜딩: 깜빡이는 메타볼 원 → 3초 후 메인 콘텐츠 전환 (최초 방문 시에만)
  useEffect(() => {
    if (hasVisitedHome) return;
    const t = setTimeout(() => {
      setAppState('ready');
      hasVisitedHome = true;
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%), 0)`;
      }

      if (appState === 'ready' && sliderTrackRef.current) {
        const rect = sliderTrackRef.current.getBoundingClientRect();
        let relativeX = e.clientX - rect.left;
        let percent = (relativeX / rect.width) * 100;
        percent = Math.max(0, Math.min(100, percent));

        // 4개 단어 위치에 스냅
        const index = Math.min(3, Math.floor(percent / 25));
        const snappedPercent = index * 25 + 12.5;
        setSliderValue(snappedPercent);
        setCurrentWord(WORDS[index]);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [appState]);

  const handleMenuHover = (text: string) => setCursorState({ type: 'text', text });
  const handleMenuLeave = () => setCursorState({ type: 'default', text: '' });

  const handleWordClick = (word: string) => {
    navigate(`/portfolio/${word.toLowerCase()}`);
  };

  const handlePortfolioClick = () => {
    navigate('/portfolio/fashion');
  };

  return (
    <div className="relative w-screen h-screen bg-[#f7f6f0] overflow-hidden md:cursor-none selection:bg-[#111] selection:text-[#f7f6f0] font-sans flex flex-col">

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .animate-blink { animation: blink 1s step-end infinite; }
      `}} />

      {/* 그리드 + 트레일 + 슬라이더 바 (동일 캔버스, 메타볼 합체) */}
      <GridTrail dark={darkMode} sliderValue={sliderValue} sliderTrackRef={sliderTrackRef} ready={appState === 'ready'} labelRefs={labelRefs} appState={appState} />

      {/* 모핑 마우스 커서 */}
      {/* Custom cursor - hidden on mobile */}
      {appState !== 'initial' && (
        <div
          ref={cursorRef}
          className="fixed top-0 left-0 pointer-events-none z-50 items-center justify-center will-change-transform mix-blend-difference hidden md:flex"
          style={{ transform: 'translate3d(-100px, -100px, 0)' }}
        >
          <div
            className={`transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] flex items-center justify-center overflow-hidden
              ${cursorState.type === 'default' ? 'w-5 h-5 rounded-full bg-[#f7f6f0]' : ''}
              ${cursorState.type === 'text' ? 'h-8 px-5 bg-[#f7f6f0] rounded-full' : ''}
            `}
          >
            {cursorState.type === 'text' && (
              <span className="text-[#111] text-[10px] md:text-xs font-medium uppercase tracking-widest whitespace-nowrap">
                {cursorState.text}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 콘텐츠 영역 */}
      <div className="absolute inset-0 flex flex-col z-10 mix-blend-difference text-[#f7f6f0] pointer-events-none">

        {/* 네비게이션 */}
        <nav className={`absolute top-0 w-full flex justify-between items-center p-6 md:px-12 pointer-events-auto transition-opacity duration-1000 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
          <button onClick={handlePortfolioClick} onMouseEnter={() => handleMenuHover('Portfolio')} onMouseLeave={handleMenuLeave} className={`text-[9px] md:text-xs font-medium uppercase tracking-widest md:cursor-none transition-opacity duration-200 ${cursorState.text === 'Portfolio' ? 'md:opacity-0' : 'opacity-100'}`}>Portfolio</button>
          <button onMouseEnter={() => handleMenuHover('LEE JAEWOONG')} onMouseLeave={handleMenuLeave} onClick={() => setDarkMode(d => !d)} className={`text-[9px] md:text-xs font-medium uppercase tracking-wider md:tracking-widest md:cursor-none transition-opacity duration-200 ${cursorState.text === 'LEE JAEWOONG' ? 'md:opacity-0' : 'opacity-100'}`}>LEE JAEWOONG</button>
          <button onClick={() => setContactOpen(true)} onMouseEnter={() => handleMenuHover('Contact')} onMouseLeave={handleMenuLeave} className={`text-[9px] md:text-xs font-medium uppercase tracking-widest md:cursor-none transition-opacity duration-200 ${cursorState.text === 'Contact' ? 'md:opacity-0' : 'opacity-100'}`}>Contact</button>
        </nav>

        {/* Top Section */}
        <div className={`flex-1 flex items-center justify-center border-b border-[#f7f6f0]/30 transition-opacity duration-1000 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
        </div>

        {/* Middle Section (Slider) */}
        <div className={`flex-1 flex items-center justify-center px-4 md:px-16 relative pointer-events-auto`}>

          <div className={`flex flex-row items-center justify-between w-full relative transition-opacity duration-1000 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
            {/* Left Number */}
            <span className={`text-[6vw] md:text-[5vw] font-mono leading-none md:mr-0 z-10 transition-opacity duration-1000 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
              {`0${Math.min(4, Math.max(1, Math.floor(sliderValue / 25) + 1))}`}
            </span>

            {/* Slider Container */}
            <div
              className="flex-1 max-w-5xl mx-2 md:mx-16 relative h-16 md:h-32 flex items-center md:cursor-none justify-end md:justify-center"
            >
              <p className={`hidden md:block absolute top-2 left-1/2 -translate-x-1/2 w-full text-center text-[8px] md:text-[9px] uppercase tracking-wider md:tracking-widest transition-opacity duration-1000 delay-300 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
                HELLO. I'M <span className="inline-block min-w-[7em]">{currentWord}</span> DESIGNER JAYDEN
              </p>

              {/* 슬라이더 트랙 - 모바일에서는 영역을 줄임 */}
              <div ref={sliderTrackRef} className={`w-full max-w-[280px] md:max-w-none h-4 relative transition-opacity duration-1000 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
              </div>

              {/* Categories */}
              <div className={`absolute top-1/2 -translate-y-1/2 md:top-auto md:translate-y-0 md:bottom-2 right-0 md:left-0 w-[240px] md:w-full flex justify-between px-0 md:px-12 text-[7px] md:text-[9px] uppercase tracking-wider md:tracking-widest transition-opacity duration-1000 delay-300 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
                {WORDS.map((word, i) => (
                  <button
                    key={word}
                    ref={el => labelRefs.current[i] = el}
                    onMouseEnter={() => handleMenuHover(word)}
                    onMouseLeave={handleMenuLeave}
                    className={`text-[5.5px] tracking-normal md:text-[9px] md:tracking-widest md:cursor-none transition-opacity duration-200 ${cursorState.text === word ? 'md:opacity-0' : 'opacity-100'}`}
                    onClick={() => handleWordClick(word)}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>

            {/* Hidden right spacer (Desktop only) */}
            <span className={`hidden md:block text-[7vw] md:text-[5vw] font-mono leading-none invisible`}>04</span>
          </div>
        </div>

        {/* Bottom Section */}
        <div className={`flex-1 border-t border-[#f7f6f0]/30 flex items-center overflow-hidden transition-opacity duration-1000 ${appState === 'ready' ? 'opacity-100' : 'opacity-0'}`}>
        </div>

      </div>

      {/* Contact Dialog */}
      <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} dark={darkMode} />
    </div>
  );
}