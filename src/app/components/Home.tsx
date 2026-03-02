import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import ContactDialog from './ContactDialog';
import { getAllProjects, type Project } from '../../lib/portfolioService';
import '../../lib/seedData';

export default function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Array<Project & { category: string }>>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    window.scrollTo(0, 0);
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
      root: null,
      rootMargin: '-40% 0px -40% 0px', // 트리거 기준선: 화면 상단/하단에서 40% 안쪽 (가운데 20% 영역)
      threshold: 0
    });

    imageRefs.current.forEach(ref => {
      if (ref) observerRef.current?.observe(ref);
    });

    return () => observerRef.current?.disconnect();
  }, [projects]);

  const activeProject = projects.find(p => `${p.category}-${p.id}` === activeProjectId) || projects[0];

  return (
    <div className="relative w-full min-h-screen bg-[#f7f6f0] text-[#111] font-sans selection:bg-[#111] selection:text-[#f7f6f0]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full flex justify-between items-center px-6 pt-4 pb-0 md:px-12 z-50">
        <div className="flex-none">
          <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="text-[7px] md:text-[9px] font-bold md:font-medium uppercase tracking-wider md:tracking-widest transition-opacity hover:opacity-50">LEE JAEWOONG</button>
        </div>
        <div className="flex-1 flex justify-end items-center gap-6 md:gap-16">
          <button onClick={() => navigate('/freedive')} className="text-[7px] md:text-[9px] font-bold md:font-medium uppercase tracking-widest transition-opacity hover:opacity-50">FREE DIVE</button>
        </div>
      </nav>

      <div className="flex flex-col md:flex-row w-full h-full relative">
        {/* Left Column (Sticky Info) - Desktop Only */}
        <div className="w-full md:w-[45%] h-screen sticky top-0 flex flex-col justify-center p-8 md:pl-24 lg:pl-32 z-10 hidden md:flex border-r border-[#111]/5">
          {activeProject && (
            <div className="w-full max-w-[280px] lg:max-w-xs transition-opacity duration-500">
              <div className="flex justify-between items-end mb-12 font-bold text-[10px] md:text-xs uppercase tracking-widest">
                <span>PROJECT</span>
                <span>{activeProject.year}</span>
              </div>

              <div className="mb-16">
                <p className="text-[10px] leading-[1.8] opacity-80 text-justify">
                  {activeProject.desc}
                </p>
              </div>

              {activeProject.showExternalLink && activeProject.externalLink && (
                <div className="mt-8">
                  <a
                    href={activeProject.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-bold uppercase tracking-widest border-b border-[#111] pb-0.5 hover:opacity-50 transition-opacity"
                  >
                    {'>'} Link
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="absolute bottom-6 left-8 md:bottom-12 md:left-24 lg:left-32">
            <button
              onClick={() => setContactOpen(true)}
              className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest hover:opacity-50 transition-opacity"
            >
              Contact me
            </button>
          </div>
        </div>

        {/* Right Column (Scrollable Images) */}
        <div className="w-full md:w-[55%] flex flex-col items-center py-32 md:py-48 px-6 md:px-12 z-0">
          {projects.map((project, idx) => (
            <div
              key={`${project.category}-${project.id}`}
              data-id={`${project.category}-${project.id}`}
              ref={(el) => { imageRefs.current[idx] = el; }}
              className="w-full max-w-2xl mb-32 md:mb-64 cursor-pointer group"
              onClick={() => navigate(`/portfolio/${project.category}`)}
            >
              <div className={`w-full ${project.aspect || 'aspect-[4/5]'} bg-[#e5e4de] overflow-hidden relative`}>
                <img
                  src={project.image}
                  alt={project.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-[1.5s] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.03]"
                />
              </div>

              {/* Mobile Info Overlay */}
              <div className="md:hidden mt-6 flex flex-col items-center text-center">
                <div className="flex justify-between w-full font-bold text-[9px] uppercase tracking-widest mb-4">
                  <span>PROJECT</span>
                  <span>{project.year}</span>
                </div>
                <p className="text-[9px] leading-relaxed opacity-80 text-left w-full mb-6">
                  {project.desc}
                </p>
                {project.showExternalLink && project.externalLink && (
                  <a
                    href={project.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-bold uppercase tracking-widest border-b border-[#111] pb-0.5 hover:opacity-50 transition-opacity self-start"
                    onClick={(e) => e.stopPropagation()} // Prevent clicking link from also navigating to portfolio
                  >
                    {'>'} Link
                  </a>
                )}
              </div>
            </div>
          ))}

          {/* Mobile Contact button */}
          <div className="md:hidden w-full flex justify-center mt-12 mb-24">
            <button
              onClick={() => setContactOpen(true)}
              className="text-[10px] font-bold uppercase tracking-widest border border-[#111] px-6 py-3 rounded-full hover:bg-[#111] hover:text-[#f7f6f0] transition-colors"
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