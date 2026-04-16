import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import ContactDialog from './ContactDialog';
import { getAllProjects, type Project } from '../../lib/portfolioService';
import '../../lib/seedData';

export default function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Array<Project & { category: string }>>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  // Landing Animation State
  const [showLanding, setShowLanding] = useState(false);
  const [landingWordIndex, setLandingWordIndex] = useState(0);
  const words = ["industrial", "fashion", "ai", "speculative", "product", "brand"];

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Smooth native scroll to center without hacky layout shifts
  const scrollToCenter = (index: number, immediate = false) => {
    const el = imageRefs.current[index];
    if (el) {
      el.scrollIntoView({
        behavior: immediate ? 'instant' : 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  };

  useEffect(() => {
    // Show landing animation once per session
    if (!sessionStorage.getItem('hasSeenLanding')) {
      setShowLanding(true);
      document.body.style.overflow = 'hidden';
      sessionStorage.setItem('hasSeenLanding', 'true');
    }

    const savedProjectId = sessionStorage.getItem('lastActiveProject');
    let targetId: string | null = null;

    getAllProjects().then(res => {
      setProjects(res);
      if (res.length > 0) {
        targetId = savedProjectId && res.some(p => `${p.category}-${p.id}` === savedProjectId)
          ? savedProjectId
          : `${res[0].category}-${res[0].id}`;

        setActiveProjectId(targetId);

        if (targetId) {
          setTimeout(() => {
            const idx = res.findIndex(p => `${p.category}-${p.id}` === targetId);
            if (idx !== -1) {
              scrollToCenter(idx, true);
            }
          }, 50);
        }
      }
    });
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-id');
          if (id) {
            setActiveProjectId(id);
            sessionStorage.setItem('lastActiveProject', id);
          }
        }
      });
    }, {
      root: scrollContainerRef.current,
      rootMargin: '0px -40% 0px -40%',
      threshold: 0
    });

    imageRefs.current.forEach(ref => {
      if (ref) observerRef.current?.observe(ref);
    });

    return () => observerRef.current?.disconnect();
  }, [projects]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      const currentIndex = projects.findIndex(p => `${p.category}-${p.id}` === activeProjectId);
      if (currentIndex === -1) return;

      e.preventDefault();

      let nextIndex = currentIndex;
      if (e.key === 'ArrowRight' && currentIndex < projects.length - 1) {
        nextIndex = currentIndex + 1;
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        nextIndex = currentIndex - 1;
      }

      if (nextIndex !== currentIndex) {
        scrollToCenter(nextIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projects, activeProjectId]);

  // Landing Animation Timer
  useEffect(() => {
    if (showLanding) {
      if (projects.length === 0 || landingWordIndex < words.length - 1) {
        const timer = setTimeout(() => {
          setLandingWordIndex(prev => (prev + 1) % words.length);
        }, 550);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setShowLanding(false);
          document.body.style.overflow = 'auto';
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [showLanding, landingWordIndex, words.length, projects.length]);

  const activeProject = projects.find(p => `${p.category}-${p.id}` === activeProjectId) || projects[0];

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111] selection:bg-[#111] selection:text-[#f3f3f3] flex flex-col justify-between font-['Pretendard',sans-serif]">

      {/* Landing Animation Overlay */}
      <AnimatePresence>
        {showLanding && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[200] bg-[#f3f3f3] flex flex-col items-center justify-center text-[#111] px-6 select-none"
          >
            <div className="text-[12px] md:text-[14px] tracking-[0.3em] flex items-center justify-center flex-wrap gap-x-4 gap-y-2 opacity-90">
              <span className="uppercase tracking-[0.4em] opacity-50">I'm</span>
              <div className="relative h-[30px] flex items-center justify-center min-w-[140px] overflow-hidden">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={landingWordIndex}
                    initial={{ y: 30, opacity: 0, filter: 'blur(5px)' }}
                    animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                    exit={{ y: -30, opacity: 0, filter: 'blur(5px)' }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute text-center lowercase font-bold text-[#111] tracking-[0.2em]"
                  >
                    {words[landingWordIndex]}
                  </motion.span>
                </AnimatePresence>
              </div>
              <span className="uppercase tracking-[0.4em] opacity-50">designer</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* TOP HEADER */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={showLanding ? { opacity: 0, y: -20 } : { opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 w-full flex justify-between items-start px-6 pt-6 pb-4 md:px-10 md:pt-8 z-50 pointer-events-none"
      >
        {/* Left: Logo Area */}
        <div className="flex-[1.5] lg:flex-1 min-w-0">
          <h1 className="text-xs md:text-sm lg:text-base font-bold tracking-[-0.02em] whitespace-nowrap leading-none text-[#111] pointer-events-auto cursor-pointer font-['Pretendard',sans-serif]" onClick={() => navigate('/')}>
            LEEJAEWOONG
          </h1>
        </div>

        {/* Center: Blurb - Dynamic Active Project Info */}
        <div className="hidden md:block absolute left-[28%] lg:left-[26%] top-6 md:top-8 max-w-[320px] text-[10px] lg:text-[11px] leading-[1.65] text-left pointer-events-auto font-medium transition-opacity duration-500 text-[#111]">
          {activeProject ? (
            <>
              <span className="font-bold block mb-[6px] text-[#111] tracking-tight text-[11px] lg:text-[12px] uppercase">
                {activeProject.title}
              </span>
              <p className="line-clamp-3 mb-2">{activeProject.desc}</p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[#111] text-[9px] lg:text-[10px]">
                <span className="font-semibold">{activeProject.year}</span>
                {activeProject.hashtags && activeProject.hashtags.map((tag, i) => (
                  <span key={i}>#{tag}</span>
                ))}
                {activeProject.showExternalLink && activeProject.externalLink && (
                  <a
                    href={activeProject.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-50 transition-opacity font-bold ml-1"
                  >
                    Link ↗
                  </a>
                )}
              </div>
            </>
          ) : (
            <span className="opacity-0">Loading...</span>
          )}
        </div>

        {/* Right: Navigation links */}
        <nav className="flex-1 flex flex-col items-end">
          <button onClick={() => setContactOpen(true)} className="text-xs md:text-sm lg:text-base font-bold tracking-[-0.02em] text-[#111] hover:opacity-60 transition-opacity pointer-events-auto font-['Pretendard',sans-serif]">CONTACT</button>
        </nav>
      </motion.header>

      {/* BOTTOM GALLERY */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={showLanding ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        ref={scrollContainerRef}
        className="absolute bottom-0 w-full h-[85vh] overflow-x-auto overflow-y-hidden flex items-end pb-[4vh] md:pb-[6vh] gap-3 md:gap-5 snap-x snap-mandatory z-40"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`
          main::-webkit-scrollbar { display: none; }
        `}</style>

        {/* Start Spacer */}
        <div className="shrink-0 w-[50vw] md:w-[40vw]" />

        {projects.map((project, idx) => {
          const isActive = `${project.category}-${project.id}` === activeProjectId;
          const aspectStr = project.aspect ? project.aspect.replace('aspect-[', '').replace(']', '') : '3/4';

          return (
            <div
              key={`${project.category}-${project.id}`}
              data-id={`${project.category}-${project.id}`}
              ref={(el) => { imageRefs.current[idx] = el; }}
              className={`snap-center shrink-0 flex flex-col items-start cursor-pointer group`}
              style={{ transformOrigin: 'bottom center' }}
              onClick={() => {
                if (!isActive) {
                  scrollToCenter(idx);
                } else {
                  navigate(`/project/${project.category}/${project.id}`);
                }
              }}
            >
              <div
                className={`transition-transform duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col items-start gap-2 md:gap-3 ${isActive ? 'scale-100 opacity-100' : 'scale-[0.80] opacity-50 hover:opacity-90'} origin-bottom`}
              >
                <div className={`flex items-center gap-[6px] text-[9.5px] md:text-[11px] font-bold tracking-tight ml-[2px]`}>
                  <span className="text-[7px] w-[10px] h-[10px] flex items-center justify-center">○</span> {project.title}
                </div>

                {/* The card size perfectly matches standard DOM width avoiding layout shift. Only the container scales visually with CSS Transforms. */}
                <div
                  className={`relative bg-[#eae9e4] rounded-[10px] md:rounded-[12px] overflow-hidden transition-all duration-500 h-[50vh] md:h-[62vh] ${isActive ? 'shadow-xl shadow-black-[0.03]' : 'shadow-md filter saturate-[0.85]'}`}
                  style={{ aspectRatio: aspectStr }}
                >
                  <img
                    src={project.image}
                    alt={project.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-[1.5s] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.03]"
                  />
                  {!isActive && (
                    <div className="absolute inset-0 bg-[#f3f3f3]/10 mix-blend-overlay z-10 transition-opacity duration-700 group-hover:opacity-0 pointer-events-none"></div>
                  )}

                  {/* Expand / View Icon */}
                  <div className="absolute top-[10px] right-[10px] md:top-[12px] md:right-[12px] w-[26px] h-[26px] md:w-[32px] md:h-[32px] bg-[#f3f3f3]/95 backdrop-blur-md rounded-[6px] md:rounded-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 shadow-sm text-[#111]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" className="scale-75 md:scale-90">
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* End Spacer - large enough for the last card to fully center */}
        <div className="shrink-0 w-[100vw] md:w-[80vw]" />
      </motion.main>

      <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} dark={false} />
    </div>
  );
}