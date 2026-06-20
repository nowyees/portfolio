import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import ContactDialog from './ContactDialog';
import { getAllProjects, type Project } from '../../lib/portfolioService';
import '../../lib/seedData';

export default function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Array<Project & { category: string }>>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const wheelTimeoutRef = useRef<number | null>(null);

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  
  // Card dimensions: 220px width on desktop, 130px on mobile
  const cardWidth = isMobile ? 130 : 220;
  
  // Bulge parameters: only cards near the center warp in 3D, side cards remain in a flat plane
  const angleStep = 32; // degrees
  const radius = isMobile ? 240 : 400; // cylinder radius for local warp
  const maxZ = isMobile ? 50 : 100; // forward bulge displacement

  // Motion value to track the current offset index continuously (e.g. during dragging or animation)
  const offsetMV = useMotionValue(0);
  const [currentOffset, setCurrentOffset] = useState(0);

  useEffect(() => {
    return offsetMV.on('change', (v) => setCurrentOffset(v));
  }, [offsetMV]);

  useEffect(() => {
    const savedProjectId = sessionStorage.getItem('lastActiveProject');
    getAllProjects().then(res => {
      setProjects(res);
      if (res.length > 0) {
        const targetId = savedProjectId && res.some(p => `${p.category}-${p.id}` === savedProjectId)
          ? savedProjectId
          : `${res[0].category}-${res[0].id}`;
        
        setActiveProjectId(targetId);
        const idx = res.findIndex(p => `${p.category}-${p.id}` === targetId);
        if (idx !== -1) {
          offsetMV.set(idx);
          setCurrentOffset(idx);
        }
      }
    });
  }, []);

  const activeIndex = projects.findIndex(p => `${p.category}-${p.id}` === activeProjectId);
  const activeProject = projects[activeIndex] || projects[0];

  // Animate offsetMV whenever activeIndex changes
  useEffect(() => {
    if (isDraggingRef.current || projects.length === 0 || activeIndex === -1) return;
    
    const controls = animate(offsetMV, activeIndex, {
      type: 'spring',
      stiffness: 220,
      damping: 16
    });
    return () => controls.stop();
  }, [activeIndex, projects]);

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
        const nextId = `${projects[nextIndex].category}-${projects[nextIndex].id}`;
        setActiveProjectId(nextId);
        sessionStorage.setItem('lastActiveProject', nextId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projects, activeProjectId]);

  // Mouse wheel scroll
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
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
        const nextId = `${projects[nextIndex].category}-${projects[nextIndex].id}`;
        setActiveProjectId(nextId);
        sessionStorage.setItem('lastActiveProject', nextId);

        wheelTimeoutRef.current = window.setTimeout(() => {
          wheelTimeoutRef.current = null;
        }, 220);
      }
    };

    const container = mainRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [projects, activeProjectId]);

  const handlePan = (event: any, info: any) => {
    isDraggingRef.current = true;
    const spacing = cardWidth; // Edge-to-edge spacing
    const dragIdxOffset = -info.offset.x / spacing;
    offsetMV.set(activeIndex + dragIdxOffset);
  };

  const handlePanEnd = (event: any, info: any) => {
    isDraggingRef.current = false;
    const finalOffset = offsetMV.get();
    const targetIndex = Math.max(0, Math.min(projects.length - 1, Math.round(finalOffset)));

    const nextId = `${projects[targetIndex].category}-${projects[targetIndex].id}`;
    setActiveProjectId(nextId);
    sessionStorage.setItem('lastActiveProject', nextId);

    animate(offsetMV, targetIndex, {
      type: 'spring',
      stiffness: 220,
      damping: 16
    });
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#0d0d0d] text-[#f7f6f0] selection:bg-[#f7f6f0] selection:text-[#0d0d0d] flex flex-col justify-between font-['Pretendard',sans-serif]">

      {/* TOP HEADER */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 w-full flex justify-between items-start px-6 pt-6 pb-4 md:px-10 md:pt-8 z-50 pointer-events-none"
      >
        {/* Left: Logo Area */}
        <div className="flex-[1.5] lg:flex-1 min-w-0">
          <h1 className="text-xs md:text-sm lg:text-base font-bold tracking-[-0.02em] whitespace-nowrap leading-none text-[#f7f6f0] pointer-events-auto cursor-pointer font-['Pretendard',sans-serif]" onClick={() => navigate('/')}>
            LEEJAEWOONG
          </h1>
        </div>

        {/* Center: Blurb - Dynamic Active Project Info */}
        <div className="hidden md:block absolute left-[28%] lg:left-[26%] top-6 md:top-8 max-w-[320px] text-[10px] lg:text-[11px] leading-[1.65] text-left pointer-events-auto font-medium transition-opacity duration-500 text-[#f7f6f0]">
          {activeProject ? (
            <>
              <span className="font-bold block mb-[6px] text-[#f7f6f0] tracking-tight text-[11px] lg:text-[12px] uppercase">
                {activeProject.title}
              </span>
              <p className="line-clamp-3 mb-2 text-[#f7f6f0]/75 font-normal">{activeProject.desc}</p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[#f7f6f0]/60 text-[9px] lg:text-[10px] font-normal">
                <span className="font-semibold text-[#f7f6f0]">{activeProject.year}</span>
                {activeProject.hashtags && activeProject.hashtags.map((tag, i) => (
                  <span key={i}>#{tag}</span>
                ))}
                {activeProject.showExternalLink && activeProject.externalLink && (
                  <a
                    href={activeProject.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-50 transition-opacity font-bold ml-1 text-[#f7f6f0]"
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
          <button onClick={() => setContactOpen(true)} className="text-xs md:text-sm lg:text-base font-bold tracking-[-0.02em] leading-none text-[#f7f6f0] hover:opacity-60 transition-opacity pointer-events-auto font-['Pretendard',sans-serif]">CONTACT</button>
        </nav>
      </motion.header>

      {/* 3D CYLINDRICAL CAROUSEL (LOCAL bulge IN THE CENTER OF A FLAT PLANE) */}
      <main
        ref={mainRef}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
        className="absolute inset-0 flex items-center justify-center z-40 overflow-hidden outline-none cursor-grab active:cursor-grabbing select-none"
        style={{ perspective: isMobile ? '550px' : '700px' }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{
            transformStyle: 'preserve-3d',
            width: `${cardWidth}px`,
            height: isMobile ? '210px' : '360px',
          }}
        >
          {projects.map((project, i) => {
            const isActive = `${project.category}-${project.id}` === activeProjectId;
            const isVisible = Math.abs(i - activeIndex) <= 4;
            if (!isVisible) return null;

            // Math to blend flat ribbon position with local 3D cylinder bulge at the center
            const offset = i - currentOffset;
            const absOffset = Math.abs(offset);

            // Flat translation X (continuous edge-to-edge strip)
            const transX_flat = offset * cardWidth;

            // Cylinder translation X & Z (curved ribbon)
            const angle = offset * angleStep;
            const transX_cylinder = radius * Math.sin(angle * Math.PI / 180);
            const transZ_cylinder = radius * (Math.cos(angle * Math.PI / 180) - 1) + maxZ;

            // Blend factor: 1 at center (offset = 0), smooth cosine decay to 0 at offset = 2
            const blend = absOffset < 2 ? Math.pow(Math.cos((offset * Math.PI) / 4), 2) : 0;

            // Blended X, Z, and Y rotation
            const transX = (1 - blend) * transX_flat + blend * transX_cylinder;
            const transZ = blend * transZ_cylinder;
            const rotY = angleStep * offset * blend;

            return (
              <div
                key={`${project.category}-${project.id}`}
                style={{
                  position: 'absolute',
                  left: '0',
                  top: '0',
                  width: '100%',
                  height: '100%',
                  transform: `translate3d(${transX}px, 0px, ${transZ}px) rotateY(${rotY}deg)`,
                  transformStyle: 'preserve-3d',
                }}
              >
                <motion.div
                  animate={{
                    opacity: isActive ? 1 : Math.max(0.15, 0.65 - Math.abs(i - activeIndex) * 0.12),
                  }}
                  transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
                  className="w-full h-full flex flex-col items-start gap-2 md:gap-3 group"
                  onClick={() => {
                    if (!isActive) {
                      const nextId = `${project.category}-${project.id}`;
                      setActiveProjectId(nextId);
                      sessionStorage.setItem('lastActiveProject', nextId);
                    } else {
                      navigate(`/project/${project.category}/${project.id}`);
                    }
                  }}
                >
                  {/* Title */}
                  <div className="flex items-center gap-[6px] text-[9.5px] md:text-[11px] font-bold tracking-tight ml-[2px] text-[#f7f6f0] opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-[7px] w-[10px] h-[10px] flex items-center justify-center">○</span> {project.title}
                  </div>

                  {/* Card Frame (Aspect ratio 2:3) */}
                  <div className="relative w-full flex-1 bg-[#1a1a1a] overflow-hidden shadow-2xl rounded-sm">
                    <img
                      src={project.image}
                      alt={project.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-[1.5s] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.02]"
                    />
                    {!isActive && (
                      <div className="absolute inset-0 bg-black/55 transition-opacity duration-700 group-hover:opacity-25 pointer-events-none"></div>
                    )}

                    {/* View Icon */}
                    <div className="absolute top-[10px] right-[10px] md:top-[12px] md:right-[12px] w-[26px] h-[26px] md:w-[32px] md:h-[32px] bg-[#f7f6f0]/95 backdrop-blur-md rounded-[6px] md:rounded-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 shadow-sm text-[#111]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" className="scale-75 md:scale-90">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                      </svg>
                    </div>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Bottom Progress Navigator */}
      <div className="fixed bottom-4 left-6 md:left-10 md:bottom-6 z-50 text-[#f7f6f0] text-[10px] md:text-[11px] font-bold font-mono tracking-widest flex items-center gap-4 pointer-events-none">
        <span>{String(activeIndex + 1 || 1).padStart(2, '0')}</span>
        <div className="w-[40px] md:w-[60px] h-[1px] bg-[#f7f6f0]/20 relative overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 h-full bg-[#f7f6f0]"
            animate={{ width: `${((activeIndex + 1 || 1) / (projects.length || 1)) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="opacity-40">{String(projects.length || 1).padStart(2, '0')}</span>
      </div>

      <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} dark={true} />
    </div>
  );
}