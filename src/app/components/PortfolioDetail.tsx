import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import GridTrail from './GridTrail';
import ContactDialog from './ContactDialog';
import { getPortfolioByCategory, type CategoryData, type MediaItem } from '../../lib/portfolioService';
import { isVideoUrl } from '../../lib/storageService';

export default function PortfolioDetail() {
  const { category } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    getPortfolioByCategory(category || '').then(result => {
      setData(result);
      setLoading(false);
    });
  }, [category]);

  // 라이트박스 열려있을 때 배경 스크롤 잠금
  useEffect(() => {
    if (selectedProject !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedProject]);

  // 로딩 상태
  if (loading) {
    return (
      <div className="w-screen h-screen bg-[#f7f6f0] flex items-center justify-center font-sans">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="text-[10px] uppercase tracking-widest text-[#111]/40"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-screen h-screen bg-[#111] flex items-center justify-center text-[#f7f6f0] font-sans">
        <p>Category not found.</p>
        <button onClick={() => navigate('/')} className="ml-4 underline">Go back</button>
      </div>
    );
  }

  const bg = darkMode ? 'bg-[#111]' : 'bg-[#f7f6f0]';
  const fg = darkMode ? 'text-[#f7f6f0]' : 'text-[#111]';
  const selBg = darkMode ? 'selection:bg-[#f7f6f0]' : 'selection:bg-[#111]';
  const selFg = darkMode ? 'selection:text-[#111]' : 'selection:text-[#f7f6f0]';
  const strokeColor = darkMode ? '#f7f6f0' : '#111';
  const borderColor = darkMode ? 'border-[#f7f6f0]/10' : 'border-[#111]/10';
  const cardBg = darkMode ? 'bg-[#1a1a1a]' : 'bg-[#e5e4de]';

  // 선택된 프로젝트의 전체 미디어 리스트 구성
  const getProjectMedia = (projectId: number): MediaItem[] => {
    const project = data.projects.find(p => p.id === projectId);
    if (!project) return [];
    // 썸네일을 첫 번째 미디어로, 이후 media 배열 추가
    const items: MediaItem[] = [{ url: project.image, type: 'image' }];
    if (project.media && project.media.length > 0) {
      items.push(...project.media);
    }
    return items;
  };

  return (
    <div ref={containerRef} className={`min-h-screen ${bg} ${fg} font-sans ${selBg} ${selFg} transition-colors duration-500`}>

      {/* 트레일 효과 배경 */}
      <GridTrail dark={darkMode} />

      {/* 트레일 오버레이 (이미지 위에 표시) */}
      <GridTrail dark={darkMode} overlay={true} />

      {/* Header */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-6 md:px-12 mix-blend-difference"
      >
        <button
          onClick={() => navigate('/')}
          className="text-[10px] md:text-xs font-medium uppercase tracking-widest text-[#f7f6f0] hover:opacity-60 transition-opacity"
        >
          Back
        </button>
        <button
          onClick={() => setDarkMode(d => !d)}
          className="text-[10px] md:text-xs font-medium uppercase tracking-widest text-[#f7f6f0] hover:opacity-60 transition-opacity"
        >
          LEE JAEWOONG
        </button>
        <button
          onClick={() => setContactOpen(true)}
          className="text-[10px] md:text-xs font-medium uppercase tracking-widest text-[#f7f6f0] hover:opacity-60 transition-opacity"
        >
          Contact
        </button>
      </motion.nav>

      {/* Hero Section */}
      <div className="h-screen flex flex-col items-center justify-center px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="text-center"
        >
          <motion.h1
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 1, 0.5, 1] }}
            className={`text-[14vw] md:text-[10vw] leading-[0.9] tracking-tight`}
            style={{ fontFamily: "'Champagne & Limousines', sans-serif", fontWeight: 700 }}
          >
            {data.title}
          </motion.h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="absolute bottom-12 flex flex-col items-center gap-3"
        >
          <motion.svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="opacity-30"
          >
            <path d="M8 2v12M8 14l-4-4M8 14l4-4" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
          <span className="text-[9px] uppercase tracking-widest opacity-30">Scroll to explore</span>
        </motion.div>
      </div>

      {/* Gallery Grid */}
      <div className="px-6 md:px-16 pb-32 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {data.projects.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 80 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.8, delay: i * 0.15, ease: [0.25, 1, 0.5, 1] }}
              className="group cursor-pointer"
              onClick={() => { setSelectedProject(project.id); setMediaIndex(0); }}
            >
              <div className={`${project.aspect} overflow-hidden ${cardBg} relative`}>
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
                {/* Media count indicator */}
                {project.media && project.media.length > 0 && (
                  <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[9px] px-2 py-1 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                    +{project.media.length} more
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-between items-baseline">
                <div>
                  <h3 className="text-[11px] md:text-[13px] uppercase tracking-widest">{project.title}</h3>
                  <p className="text-[10px] mt-1 opacity-40">{project.desc}</p>
                </div>
                <span className="text-[10px] font-mono opacity-30">{project.year}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className={`border-t ${borderColor} px-6 md:px-16 py-12 flex justify-between items-center relative z-10`}
      >
        <button
          onClick={() => navigate('/')}
          className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
        >
          Back to Home
        </button>
        <span className="text-[10px] uppercase tracking-widest opacity-20">Jayden &mdash; {data.title} Design</span>
      </motion.div>

      {/* Media Lightbox */}
      <AnimatePresence>
        {selectedProject !== null && (() => {
          const project = data.projects.find(p => p.id === selectedProject);
          if (!project) return null;
          const allMedia = getProjectMedia(selectedProject);
          const currentMedia = allMedia[mediaIndex];
          const hasMultiple = allMedia.length > 1;
          const hasPrev = mediaIndex > 0;
          const hasNext = mediaIndex < allMedia.length - 1;

          const goPrev = (e?: React.MouseEvent) => {
            e?.stopPropagation();
            if (hasPrev) setMediaIndex(i => i - 1);
          };

          const goNext = (e?: React.MouseEvent) => {
            e?.stopPropagation();
            if (hasNext) setMediaIndex(i => i + 1);
          };

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-6 md:p-16 cursor-auto"
              onClick={() => setSelectedProject(null)}
              onWheel={(e) => {
                if (!hasMultiple) return;
                if (e.deltaY > 0 && hasNext) setMediaIndex(i => i + 1);
                if (e.deltaY < 0 && hasPrev) setMediaIndex(i => i - 1);
              }}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                (e.currentTarget as any).__touchStartX = touch.clientX;
                (e.currentTarget as any).__touchStartY = touch.clientY;
              }}
              onTouchEnd={(e) => {
                const startX = (e.currentTarget as any).__touchStartX;
                const startY = (e.currentTarget as any).__touchStartY;
                if (startX === undefined || startY === undefined) return;

                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;

                const diffX = startX - endX;
                const diffY = startY - endY;

                // 수평 스와이프가 수직 스와이프보다 클 때 (좌우 넘기기)
                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                  if (diffX > 0 && hasNext) setMediaIndex(i => i + 1); // 스와이프 레프트 -> 다음
                  if (diffX < 0 && hasPrev) setMediaIndex(i => i - 1); // 스와이프 라이트 -> 이전
                }
                // 수직 스와이프가 더 클 때 (상하 넘기기 - 기존 유지)
                else if (Math.abs(diffY) > 50) {
                  if (diffY > 0 && hasNext) setMediaIndex(i => i + 1);
                  if (diffY < 0 && hasPrev) setMediaIndex(i => i - 1);
                }
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedProject(null)}
                className="absolute top-6 right-6 md:top-8 md:right-12 text-[10px] uppercase tracking-widest text-[#f7f6f0] opacity-60 hover:opacity-100 transition-opacity z-10"
              >
                Close
              </button>

              {/* Media counter */}
              {hasMultiple && (
                <div className="absolute top-6 left-6 md:top-8 md:left-12 text-[10px] uppercase tracking-widest text-[#f7f6f0] opacity-30">
                  {mediaIndex + 1} / {allMedia.length}
                </div>
              )}

              {/* Media display */}
              <motion.div
                key={`${selectedProject}-${mediaIndex}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="relative max-w-5xl w-full flex-1 flex items-center justify-center min-h-0"
                onClick={(e) => e.stopPropagation()}
              >
                {currentMedia?.type === 'video' || (currentMedia && isVideoUrl(currentMedia.url)) ? (
                  <video
                    src={currentMedia.url}
                    controls
                    autoPlay
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                ) : (
                  <img
                    src={currentMedia?.url}
                    alt={project.title}
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                )}
              </motion.div>

              {/* Desktop arrows (sides) - navigate media */}
              {hasMultiple && (
                <>
                  <button
                    onClick={goPrev}
                    className={`hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 w-16 h-16 items-center justify-center text-[#f7f6f0] transition-opacity text-4xl ${hasPrev ? 'opacity-50 hover:opacity-100' : 'opacity-10 cursor-default'
                      }`}
                  >
                    ←
                  </button>
                  <button
                    onClick={goNext}
                    className={`hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 w-16 h-16 items-center justify-center text-[#f7f6f0] transition-opacity text-4xl ${hasNext ? 'opacity-50 hover:opacity-100' : 'opacity-10 cursor-default'
                      }`}
                  >
                    →
                  </button>
                </>
              )}

              {/* Info + mobile arrows + dots */}
              <div className="mt-4 w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-baseline text-[#f7f6f0]">
                  <div>
                    <h3 className="text-[11px] md:text-[13px] uppercase tracking-widest">{project.title}</h3>
                    <p className="text-[10px] mt-1 opacity-40">{project.desc}</p>
                  </div>
                  <span className="text-[10px] font-mono opacity-30">{project.year}</span>
                </div>

                {/* Mobile arrows (bottom) */}
                {hasMultiple && (
                  <div className="flex md:hidden justify-center items-center gap-8 mt-4">
                    <button
                      onClick={goPrev}
                      className={`w-12 h-12 flex items-center justify-center text-[#f7f6f0] transition-opacity text-3xl ${hasPrev ? 'opacity-60' : 'opacity-15'
                        }`}
                    >
                      ←
                    </button>
                    <span className="text-[10px] text-[#f7f6f0] opacity-30">
                      {mediaIndex + 1} / {allMedia.length}
                    </span>
                    <button
                      onClick={goNext}
                      className={`w-12 h-12 flex items-center justify-center text-[#f7f6f0] transition-opacity text-3xl ${hasNext ? 'opacity-60' : 'opacity-15'
                        }`}
                    >
                      →
                    </button>
                  </div>
                )}

                {/* Media dots */}
                {hasMultiple && (
                  <div className="flex justify-center gap-2 mt-3">
                    {allMedia.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setMediaIndex(idx)}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${idx === mediaIndex ? 'bg-white scale-125' : 'bg-white/30 hover:bg-white/50'
                          }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>


      {/* Contact Dialog */}
      <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} dark={darkMode} />
    </div >
  );
}