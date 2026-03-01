import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import GridTrail from './GridTrail';
import ContactDialog from './ContactDialog';
import { getPortfolioByCategory, type CategoryData } from '../../lib/portfolioService';

export default function PortfolioDetail() {
  const { category } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {data.projects.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 80 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.8, delay: i * 0.15, ease: [0.25, 1, 0.5, 1] }}
              className="group cursor-pointer"
              onClick={() => setSelectedProject(project.id)}
            >
              <div className={`${project.aspect} overflow-hidden ${cardBg} relative`}>
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
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

      {/* Lightbox */}
      <AnimatePresence>
        {selectedProject !== null && (() => {
          const project = data.projects.find(p => p.id === selectedProject);
          if (!project) return null;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 md:p-16 cursor-pointer"
              onClick={() => setSelectedProject(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                className="relative max-w-5xl w-full max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-contain max-h-[75vh]"
                />
                <div className="mt-6 flex justify-between items-baseline">
                  <div>
                    <h3 className="text-[11px] md:text-[13px] uppercase tracking-widest">{project.title}</h3>
                    <p className="text-[10px] mt-1 opacity-40">{project.desc}</p>
                  </div>
                  <span className="text-[10px] font-mono opacity-30">{project.year}</span>
                </div>
              </motion.div>
              <button
                onClick={() => setSelectedProject(null)}
                className="absolute top-6 right-6 md:top-8 md:right-12 text-[10px] uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
              >
                Close
              </button>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Contact Dialog */}
      <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} dark={darkMode} />
    </div>
  );
}