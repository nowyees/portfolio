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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isScrollingRef = useRef(false);
  const wheelTimeoutRef = useRef<number | null>(null);

  // Smooth native scroll to center without hacky layout shifts
  const scrollToCenter = (index: number, immediate = false) => {
    const container = scrollContainerRef.current;
    const el = imageRefs.current[index];
    if (el && container) {
      isScrollingRef.current = true;
      // Disable scroll-snap so Safari doesn't fight the programmatic scroll
      container.style.scrollSnapType = 'none';

      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const scrollLeft = container.scrollLeft + (elRect.left - containerRect.left) - (containerRect.width / 2) + (elRect.width / 2);
      container.scrollTo({
        left: scrollLeft,
        behavior: immediate ? 'instant' : 'smooth'
      });

      // Re-enable snap after scroll completes
      setTimeout(() => {
        if (container) container.style.scrollSnapType = 'x mandatory';
        isScrollingRef.current = false;
      }, immediate ? 50 : 800);
    }
  };

  useEffect(() => {

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
      if (isScrollingRef.current) return;
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

  // Mouse wheel vertical to horizontal mapping (Step-by-step smooth feel)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Trackpads native horizontal scroll should be ignored
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      e.preventDefault();

      if (wheelTimeoutRef.current) return;

      const currentIndex = projects.findIndex(p => `${p.category}-${p.id}` === activeProjectId);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      if (e.deltaY > 5 && currentIndex < projects.length - 1) {
        nextIndex = currentIndex + 1;
      } else if (e.deltaY < -5 && currentIndex > 0) {
        nextIndex = currentIndex - 1;
      }

      if (nextIndex !== currentIndex) {
        setActiveProjectId(`${projects[nextIndex].category}-${projects[nextIndex].id}`);
        scrollToCenter(nextIndex);

        wheelTimeoutRef.current = window.setTimeout(() => {
          wheelTimeoutRef.current = null;
        }, 150); // Aggressively reduced timeout to allow rapid scrolling
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [projects, activeProjectId]);

  const activeProject = projects.find(p => `${p.category}-${p.id}` === activeProjectId) || projects[0];

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#f3f3f3] text-[#111] selection:bg-[#111] selection:text-[#f3f3f3] flex flex-col justify-between font-['Pretendard',sans-serif]">

      {/* TOP HEADER */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
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
          <button onClick={() => setContactOpen(true)} className="text-xs md:text-sm lg:text-base font-bold tracking-[-0.02em] leading-none text-[#111] hover:opacity-60 transition-opacity pointer-events-auto font-['Pretendard',sans-serif]">CONTACT</button>
        </nav>
      </motion.header>

      {/* BOTTOM GALLERY */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        ref={scrollContainerRef}
        className="absolute bottom-0 w-full h-[85vh] overflow-x-auto overflow-y-hidden flex items-center md:items-end pb-[6vh] md:pb-[8vh] gap-3 md:gap-5 snap-x snap-mandatory z-40"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`
          main::-webkit-scrollbar { display: none; }
        `}</style>

        {/* Start Spacer with Scroll Prompt */}
        <div className="shrink-0 w-[50vw] md:w-[40vw] h-full relative">
          <motion.div
            animate={{ x: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="absolute left-1/2 -translate-x-1/2 bottom-[29vh] md:bottom-[37vh] translate-y-1/2 hidden md:flex items-center gap-2 text-[9px] md:text-[10px] uppercase tracking-widest font-bold opacity-30 whitespace-nowrap"
          >
            <span>Scroll to discover</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </motion.div>
        </div>

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
                  // Force active state immediately so second click navigates
                  const newId = `${project.category}-${project.id}`;
                  setActiveProjectId(newId);
                  sessionStorage.setItem('lastActiveProject', newId);
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
                  className={`relative bg-[#eae9e4] overflow-hidden transition-all duration-500 h-[45vh] md:h-[62vh] max-w-[80vw] md:max-w-none ${isActive ? 'shadow-xl shadow-black-[0.03]' : 'shadow-md filter saturate-[0.85]'}`}
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
        <div className="shrink-0 w-[100vw] md:w-[80vw] h-[1px]" />
      </motion.main>

      {/* Bottom Progress Navigator */}
      <div className="fixed bottom-4 left-6 md:left-10 md:bottom-6 z-50 text-[#111] text-[10px] md:text-[11px] font-bold font-mono tracking-widest flex items-center gap-4 pointer-events-none">
        <span>{String(projects.findIndex(p => `${p.category}-${p.id}` === activeProjectId) + 1 || 1).padStart(2, '0')}</span>
        <div className="w-[40px] md:w-[60px] h-[1px] bg-[#111]/20 relative overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 h-full bg-[#111]"
            animate={{ width: `${((projects.findIndex(p => `${p.category}-${p.id}` === activeProjectId) + 1 || 1) / (projects.length || 1)) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="opacity-40">{String(projects.length || 1).padStart(2, '0')}</span>
      </div>

      <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} dark={false} />
    </div>
  );
}