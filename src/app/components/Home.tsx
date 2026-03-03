import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import ContactDialog from './ContactDialog';
import GridTrail from './GridTrail';
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

  useEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTo(0, 0);
    getAllProjects().then(res => {
      setProjects(res);
      if (res.length > 0) {
        setActiveProjectId(`${res[0].category}-${res[0].id}`);
      }
    });
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveProjectId(entry.target.getAttribute('data-id'));
        }
      });
    }, {
      root: scrollContainerRef.current,
      rootMargin: '-30% 0px -30% 0px', // Trigger when image enters the middle 40%
      threshold: 0
    });

    imageRefs.current.forEach(ref => {
      if (ref) observerRef.current?.observe(ref);
    });

    return () => observerRef.current?.disconnect();
  }, [projects]);

  const activeProject = projects.find(p => `${p.category}-${p.id}` === activeProjectId) || projects[0];

  return (
    <div
      ref={scrollContainerRef}
      className="relative w-full h-screen overflow-y-auto overflow-x-hidden snap-y snap-mandatory bg-[#f7f6f0] text-[#111] font-sans selection:bg-[#111] selection:text-[#f7f6f0] scroll-smooth"
      style={{ fontFamily: "'Champagne & Limousines', sans-serif" }}
    >
      <GridTrail dark={false} overlay={false} />

      {/* Navigation */}
      <nav className="fixed top-0 w-full flex justify-between items-center px-6 pt-4 pb-0 md:px-12 z-50 mix-blend-difference text-[#f7f6f0] md:mix-blend-normal md:text-[#111]">
        <div className="flex-none">
          <button onClick={() => { scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-[9px] md:text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-50">LEE JAEWOONG</button>
        </div>
        <div className="flex-1 flex justify-end items-center gap-6 md:gap-16">
          <button onClick={() => navigate('/freedive')} className="text-[9px] md:text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-50">FREE DIVE</button>
        </div>
      </nav>

      <div className="flex flex-col md:flex-row w-full relative min-h-max">
        {/* Left Column (Sticky Info) - Desktop Only */}
        <div className="w-full md:w-[45%] lg:w-[40%] h-screen sticky top-0 flex flex-col justify-center p-8 md:pl-16 lg:pl-24 z-10 hidden md:flex">
          {activeProject && (
            <div className="w-full max-w-lg lg:max-w-2xl transition-opacity duration-500">
              <div className="flex justify-between items-end mb-16 font-bold text-base md:text-xl lg:text-2xl uppercase tracking-widest">
                <span>{activeProject.title}</span>
                <span>{activeProject.year}</span>
              </div>

              <div className="mb-20">
                <p className="text-sm md:text-base lg:text-lg leading-[2] md:leading-[2.2] opacity-80 text-justify font-sans">
                  {/* Body text uses generic sans/serif for readability, while titles use Champagne */}
                  {activeProject.desc}
                </p>
              </div>

              {activeProject.showExternalLink && activeProject.externalLink && (
                <div className="mt-10">
                  <a
                    href={activeProject.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold uppercase tracking-widest border-b border-[#111] pb-1 hover:opacity-50 transition-opacity"
                  >
                    {'>'} Link
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="absolute bottom-6 left-6 md:bottom-12 md:left-12 lg:left-16">
            <button
              onClick={() => setContactOpen(true)}
              className="text-[10px] md:text-xs font-bold uppercase tracking-widest hover:opacity-50 transition-opacity"
            >
              CONTACT ME
            </button>
          </div>
        </div>

        {/* Right Column (Scrollable Images) */}
        <div className="w-full md:w-[55%] lg:w-[60%] flex flex-col items-center z-0 pt-[20vh] pb-[20vh] gap-[4vh]">
          {projects.map((project, idx) => {
            const isActive = `${project.category}-${project.id}` === activeProjectId;
            return (
              <div
                key={`${project.category}-${project.id}`}
                data-id={`${project.category}-${project.id}`}
                ref={(el) => { imageRefs.current[idx] = el; }}
                className="w-full h-[60vh] flex justify-center items-center snap-center cursor-pointer group px-6 md:px-12 shrink-0"
                onClick={() => navigate(`/portfolio/${project.category}`)}
              >
                <div
                  className={`w-full h-full max-w-[90%] md:max-w-3xl lg:max-w-5xl bg-[#e5e4de] overflow-hidden relative shadow-md transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${isActive ? 'scale-100 opacity-100' : 'scale-[0.88] opacity-50'}`}
                >
                  <img
                    src={project.image}
                    alt={project.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-[1.5s] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.03]"
                  />
                  {!isActive && (
                    <div className="absolute inset-0 bg-[#000]/10 mix-blend-overlay"></div>
                  )}
                </div>

                {/* Mobile Info Overlay */}
                <div className="md:hidden mt-10 flex flex-col items-center text-center w-full max-w-[85%] absolute bottom-[-10vh] pointer-events-none">
                  <div className={`flex justify-between w-full font-bold text-[11px] uppercase tracking-widest mb-4 transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                    <span>{project.title}</span>
                    <span>{project.year}</span>
                  </div>
                  <p className={`text-[11px] font-sans leading-relaxed opacity-80 text-left w-full mb-6 max-h-24 overflow-hidden text-ellipsis line-clamp-3 transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                    {project.desc}
                  </p>
                  {project.showExternalLink && project.externalLink && (
                    <a
                      href={project.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-[11px] font-bold uppercase tracking-widest border-b border-[#111] pb-0.5 pointer-events-auto hover:opacity-50 transition-opacity duration-700 self-start ${isActive ? 'opacity-100' : 'opacity-0'}`}
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
              className="text-xs font-bold uppercase tracking-widest border border-[#111] px-8 py-3 rounded-full hover:bg-[#111] hover:text-[#f7f6f0] transition-colors"
            >
              Contact me
            </button>
          </div>
        </div>
      </div>

      <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} dark={false} />
    </div>
  );
}