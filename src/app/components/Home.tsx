import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import ContactDialog from './ContactDialog';
import GridTrail from './GridTrail';
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

  useEffect(() => {
    // Show landing animation once per session
    if (!sessionStorage.getItem('hasSeenLanding')) {
      setShowLanding(true);
      document.body.style.overflow = 'hidden';
      sessionStorage.setItem('hasSeenLanding', 'true');
    }

    // When mounting, prioritize the saved active project ID if available
    const savedProjectId = sessionStorage.getItem('lastActiveProject');
    let targetId: string | null = null;

    getAllProjects().then(res => {
      setProjects(res);
      if (res.length > 0) {
        targetId = savedProjectId && res.some(p => `${p.category}-${p.id}` === savedProjectId)
          ? savedProjectId
          : `${res[0].category}-${res[0].id}`;

        setActiveProjectId(targetId);

        // Scroll to the restored position after rendering
        if (targetId) {
          setTimeout(() => {
            const idx = res.findIndex(p => `${p.category}-${p.id}` === targetId);
            if (idx !== -1 && imageRefs.current[idx]) {
              // Ensure instant scroll by manipulating the ref if needed, or just auto
              if (scrollContainerRef.current) scrollContainerRef.current.style.scrollBehavior = 'auto';
              imageRefs.current[idx]?.scrollIntoView({ behavior: 'auto', block: 'start' });
            } else if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTo(0, 0);
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
      rootMargin: '-30% 0px -30% 0px',
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
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

      const currentIndex = projects.findIndex(p => `${p.category}-${p.id}` === activeProjectId);
      if (currentIndex === -1) return;

      e.preventDefault(); // Prevent default scroll

      let nextIndex = currentIndex;
      if (e.key === 'ArrowDown' && currentIndex < projects.length - 1) {
        nextIndex = currentIndex + 1;
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        nextIndex = currentIndex - 1;
      }

      if (nextIndex !== currentIndex && imageRefs.current[nextIndex]) {
        imageRefs.current[nextIndex]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projects, activeProjectId]);

  const activeProject = projects.find(p => `${p.category}-${p.id}` === activeProjectId) || projects[0];

  // Landing Animation Timer
  useEffect(() => {
    if (showLanding) {
      if (projects.length === 0 || landingWordIndex < words.length - 1) {
        // Keep cycling until projects are loaded AND we've shown at least all words once
        // If we reach the end but projects aren't loaded, loop back to the start
        const timer = setTimeout(() => {
          setLandingWordIndex(prev => (prev + 1) % words.length);
        }, 550);
        return () => clearTimeout(timer);
      } else {
        // Projects are loaded AND we finished at least one cycle
        const timer = setTimeout(() => {
          setShowLanding(false);
          document.body.style.overflow = 'auto';
        }, 1000); // Hold final frame before fading
        return () => clearTimeout(timer);
      }
    }
  }, [showLanding, landingWordIndex, words.length, projects.length]);

  return (
    <div
      ref={scrollContainerRef}
      className="relative w-full h-screen overflow-y-auto overflow-x-hidden snap-y snap-mandatory bg-[#f7f6f0] text-[#111] selection:bg-[#111] selection:text-[#f7f6f0]"
      style={{ fontFamily: "'Champagne & Limousines', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}
    >
      {/* Landing Animation Overlay */}
      <AnimatePresence>
        {showLanding && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[200] bg-[#f7f6f0] flex flex-col items-center justify-center text-[#111] px-6 select-none"
          >
            <div className="text-[12px] md:text-[14px] tracking-[0.3em] flex items-center justify-center flex-wrap gap-x-4 gap-y-2 opacity-90" style={{ fontFamily: "'Champagne & Limousines', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
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

      <GridTrail dark={false} overlay={false} />

      {/* Navigation */}
      <motion.nav
        initial={{ opacity: 0, y: -40 }}
        animate={showLanding ? { opacity: 0, y: -40 } : { opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 w-full flex justify-between items-center px-6 pt-4 pb-0 md:px-12 z-50 mix-blend-difference text-[#f7f6f0] md:mix-blend-normal md:text-[#111]"
      >
        <div className="flex-none">
          <button onClick={() => { scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-[9px] md:text-[11px] font-bold uppercase transition-opacity hover:opacity-70">LEE JAEWOONG</button>
        </div>
        <div className="flex-1 flex justify-end items-center gap-6 md:gap-16">
          <button onClick={() => navigate('/freedive')} className="text-[9px] md:text-[11px] font-bold uppercase transition-opacity hover:opacity-100 opacity-60">FREE DIVE</button>
        </div>
      </motion.nav>

      {/* Side Navigator */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={showLanding ? { opacity: 0, x: 50 } : { opacity: 1, x: 0 }}
        transition={{ duration: 1.2, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="fixed right-4 md:right-8 lg:right-12 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-4 mix-blend-difference text-[#f7f6f0] md:mix-blend-normal md:text-[#111] pointer-events-none"
      >
        {/* Tracker text (hidden on mobile) */}
        <div className="hidden md:block text-[9px] md:text-[10px] tracking-widest font-bold opacity-80" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          {projects.length > 0 ? `${String(Math.max(0, projects.findIndex(p => `${p.category}-${p.id}` === activeProjectId)) + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}` : ''}
        </div>
        {/* Dots */}
        <div className="flex flex-col gap-3 md:mt-4 pointer-events-auto">
          {projects.map((p, i) => (
            <button
              key={`${p.category}-${p.id}`}
              onClick={() => imageRefs.current[i]?.scrollIntoView({ behavior: 'smooth' })}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${projects.findIndex(p => `${p.category}-${p.id}` === activeProjectId) === i ? 'bg-current scale-150' : 'bg-current opacity-40 hover:opacity-80'}`}
              aria-label={`Go to project ${i + 1}`}
            />
          ))}
        </div>
      </motion.div>

      <div className="flex flex-col md:flex-row w-full relative min-h-max">
        {/* Left Column (Sticky Info) - Desktop Only */}
        <motion.div
          initial={{ opacity: 0, filter: 'blur(8px)' }}
          animate={showLanding ? { opacity: 0, filter: 'blur(8px)' } : { opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="w-full md:w-[48%] lg:w-[45%] h-screen sticky top-0 flex flex-col pl-6 pr-8 py-8 md:pl-12 md:pr-16 md:py-16 lg:pl-12 lg:pr-24 lg:py-16 z-10 hidden md:flex"
        >
          {/* Logo — upper area (approx 15% from top) */}
          <div className="pt-[10vh] w-[110%] -ml-2">
            <img
              src="/images/logo.png"
              alt="Jaydne. L(ee)"
              className="w-full max-w-full h-auto select-none pointer-events-none"
              draggable={false}
            />
          </div>

          <div className="flex-1"></div>

          {/* Project Info — lower area (approx 70% from top) */}
          <div className="pb-12 w-[95%]">
            {activeProject && (
              <div className="w-full transition-opacity duration-500">
                <div className="mb-8 font-bold text-base md:text-lg uppercase tracking-tighter font-['Pretendard',sans-serif]">
                  <span>{activeProject.title}</span>
                </div>

                <div className="mb-2">
                  <p className="text-sm md:text-base leading-normal opacity-85 text-justify font-['Pretendard',sans-serif]">
                    {activeProject.desc}
                  </p>
                </div>

                <div className="mb-3 text-[10px] md:text-xs font-['Pretendard',sans-serif] tracking-tighter font-normal mt-4">
                  <span className="opacity-70">{activeProject.year}</span>
                </div>

                {activeProject.hashtags && activeProject.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {activeProject.hashtags.map((tag, i) => (
                      <span key={i} className="text-xs opacity-60 font-['Pretendard',sans-serif] font-normal">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Hide external link on the Home page per user request */}
              </div>
            )}
          </div>

          {/* Contact — bottom */}
          <div>
            <button
              onClick={() => setContactOpen(true)}
              className="text-[10px] md:text-xs font-bold transition-opacity hover:opacity-70"
            >
              Contact me
            </button>
          </div>
        </motion.div>

        {/* Right Column (Scrollable Images) */}
        <motion.div
          initial={{ opacity: 0, y: 150 }}
          animate={showLanding ? { opacity: 0, y: 150 } : { opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="w-full md:w-[52%] lg:w-[55%] flex flex-col items-center z-0 pt-[22vh] md:pt-[12vh] pb-[20vh] gap-[6vh]"
        >
          {projects.map((project, idx) => {
            const isActive = `${project.category}-${project.id}` === activeProjectId;
            // Get aspect ratio safely, default to 3/4 if missing or malformed
            const aspectStr = project.aspect ? project.aspect.replace('aspect-[', '').replace(']', '') : '3/4';

            return (
              <div
                key={`${project.category}-${project.id}`}
                data-id={`${project.category}-${project.id}`}
                ref={(el) => { imageRefs.current[idx] = el; }}
                className="w-full h-[100dvh] md:h-[82vh] flex flex-col justify-center items-center snap-center cursor-pointer group px-6 pt-[8vh] md:pt-0 md:pl-[16%] md:pr-6 shrink-0 pointer-events-none relative"
                onClick={() => navigate(`/project/${project.category}/${project.id}`)}
              >
                <div
                  className={`relative shadow-md transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${isActive ? 'scale-100 opacity-100' : 'scale-[0.88] opacity-50'} pointer-events-auto bg-[#e5e4de] flex justify-center items-center h-[55vh] md:h-full`}
                  style={{
                    maxHeight: '100%',
                    maxWidth: '100%',
                    aspectRatio: aspectStr
                  }}
                >
                  <img
                    src={project.image}
                    alt={project.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-[1.5s] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.03]"
                  />
                  {!isActive && (
                    <div className="absolute inset-0 bg-black/10 mix-blend-overlay z-10"></div>
                  )}
                </div>

                {/* Mobile Info Overlay */}
                <div className="md:hidden mt-6 flex flex-col items-center text-center w-full max-w-[85%] pointer-events-none">
                  <div className={`flex justify-between w-full font-bold text-sm mb-4 transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                    <span>{project.title}</span>
                    <span className="text-[11px] font-normal tracking-tighter opacity-80">{project.year}</span>
                  </div>
                  <p className={`text-xs leading-relaxed opacity-100 text-left w-full mb-6 max-h-24 overflow-hidden text-ellipsis line-clamp-3 transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                    {project.desc}
                  </p>
                  {project.showExternalLink && project.externalLink && (
                    <a
                      href={project.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-xs font-bold border-b border-[#111] pb-0.5 pointer-events-auto hover:opacity-50 transition-opacity duration-700 self-start ${isActive ? 'opacity-100' : 'opacity-0'}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {'>'} Link
                    </a>
                  )}
                </div>
              </div>
            );
          })}

          {/* Mobile Contact button area (snaps to end) */}
          <div className="md:hidden w-full h-[30vh] flex justify-center items-start snap-center pt-16 pb-32">
            <button
              onClick={() => setContactOpen(true)}
              className="text-sm font-bold border border-[#111] px-8 py-3 rounded-full hover:bg-[#111] hover:text-[#f7f6f0] transition-colors"
            >
              Contact me
            </button>
          </div>
        </motion.div>
      </div>

      <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} dark={false} />
    </div >
  );
}