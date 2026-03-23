import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import GridTrail from './GridTrail';
import ContactDialog from './ContactDialog';
import { getPortfolioByCategory, type Project, type MediaItem } from '../../lib/portfolioService';
import { isVideoUrl } from '../../lib/storageService';

export default function ProjectDetail() {
    const { category, id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [contactOpen, setContactOpen] = useState(false);
    const [cols, setCols] = useState<1 | 4>(1);
    const [landscapeItems, setLandscapeItems] = useState<Record<number, boolean>>({});
    const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

    const [activeIndex, setActiveIndex] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        window.scrollTo(0, 0);
        setLoading(true);
        getPortfolioByCategory(category || '').then(result => {
            if (result) {
                const found = result.projects.find(p => String(p.id) === id);
                setProject(found || null);
            }
            setLoading(false);
        });
    }, [category, id]);

    useEffect(() => {
        const currentContainer = scrollContainerRef.current;
        if (!currentContainer) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const idx = Number(entry.target.getAttribute('data-index'));
                    if (!isNaN(idx)) setActiveIndex(idx);
                }
            });
        }, {
            root: currentContainer,
            threshold: 0.5
        });

        sectionRefs.current.forEach((ref: HTMLDivElement | null) => {
            if (ref) observer.observe(ref);
        });

        return () => observer.disconnect();
    }, [project]);

    const allMedia: MediaItem[] = [];
    if (project && project.media && project.media.length > 0) {
        allMedia.push(...project.media);
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['TEXTAREA', 'INPUT'].includes((e.target as HTMLElement).tagName)) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = Math.min(activeIndex + 1, allMedia.length);
                sectionRefs.current[next]?.scrollIntoView({ behavior: 'smooth' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = Math.max(activeIndex - 1, 0);
                sectionRefs.current[prev]?.scrollIntoView({ behavior: 'smooth' });
            }
        };
        window.addEventListener('keydown', handleKeyDown, { passive: false });
        // Clean up
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeIndex, allMedia.length, selectedMedia]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedMedia) {
                setSelectedMedia(null);
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [selectedMedia]);


    // Loading
    if (loading) {
        return (
            <div className="w-screen h-screen bg-[#f3f3f3] flex items-center justify-center font-['Pretendard',sans-serif]">
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

    // Not found
    if (!project) {
        return (
            <div className="w-screen h-screen bg-[#f3f3f3] flex flex-col items-center justify-center gap-4 font-['Pretendard',sans-serif]">
                <p className="text-sm opacity-60">Project not found.</p>
                <button onClick={() => navigate('/')} className="text-[10px] uppercase tracking-widest underline opacity-40 hover:opacity-100 transition-opacity">
                    Go back
                </button>
            </div>
        );
    }

    return (
        <div
            ref={scrollContainerRef}
            className={`w-full h-screen overflow-y-auto overflow-x-hidden bg-[#f3f3f3] text-[#111] selection:bg-[#111] selection:text-[#f3f3f3] font-['Pretendard',sans-serif] ${cols === 1 ? 'snap-y snap-mandatory' : ''}`}
        >
            <GridTrail dark={false} />

            {/* TOP HEADER (Same as Home) */}
            <header className="fixed top-0 w-full flex justify-between items-start px-6 pt-6 pb-4 md:px-10 md:pt-8 z-50 pointer-events-none mix-blend-difference md:mix-blend-normal">
                {/* Left: Logo Area */}
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl md:text-2xl lg:text-[28px] font-bold tracking-[-0.03em] whitespace-nowrap leading-none text-white md:text-[#111] pointer-events-auto cursor-pointer font-['Helvetica',sans-serif]" onClick={() => navigate('/')}>
                        JAYDEN.L<sup className="text-[10px] md:text-sm font-normal ml-[2px]">®</sup>
                    </h1>
                </div>

                {/* Right: Navigation links */}
                <nav className="flex-1 flex flex-col items-end gap-[2px] text-[10px] lg:text-[11px] font-medium opacity-60 pointer-events-auto text-white md:text-[#111]">
                    <button onClick={() => navigate('/freedive')} className="hover:opacity-100 transition-opacity">Free Dive</button>
                    <button onClick={() => setContactOpen(true)} className="hover:opacity-100 transition-opacity">Contact</button>
                </nav>
            </header>

            {/* Side Navigator */}
            <div className="fixed right-6 md:right-10 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-4 mix-blend-difference text-white md:mix-blend-normal md:text-[#111] pointer-events-none">
                {/* Tracker text */}
                <div className="text-[9px] md:text-[10px] tracking-widest font-bold opacity-80" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    {activeIndex === 0 ? 'INFO' : `${String(activeIndex).padStart(2, '0')} / ${String(allMedia.length).padStart(2, '0')}`}
                </div>
                {/* Dots */}
                <div className="flex flex-col gap-3 mt-4 pointer-events-auto">
                    {Array.from({ length: allMedia.length + 1 }).map((_, i) => (
                        <button
                            key={i}
                            onClick={() => sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth' })}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeIndex === i ? 'bg-current scale-150' : 'bg-current opacity-40 hover:opacity-80'}`}
                            aria-label={`Go to slide ${i}`}
                        />
                    ))}
                </div>
            </div>

            {/* Slide 0: Hero & Info */}
            <div
                data-index={0}
                ref={(el) => { sectionRefs.current[0] = el; }}
                className={`w-full min-h-screen flex flex-col items-center justify-center px-6 py-20 relative z-10 ${cols === 1 ? 'snap-center' : ''}`}
            >
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="max-w-4xl px-4 md:px-12 w-full flex flex-col items-center text-[#111]"
                >
                    <div className="text-xs md:text-sm tracking-widest opacity-60 mb-6 font-semibold uppercase">
                        {project.year}
                    </div>
                    <h1
                        className="text-[14vw] md:text-[10vw] leading-[0.9] tracking-[-0.05em] mb-14 text-center font-['Helvetica',sans-serif]"
                        style={{ fontWeight: 700 }}
                    >
                        {project.title}
                    </h1>

                    <div className="w-full max-w-2xl mx-auto flex flex-col items-center text-center">
                        <p className="text-sm md:text-base leading-relaxed opacity-70 font-medium">
                            {project.desc}
                        </p>

                        {project.hashtags && project.hashtags.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-2 mt-8">
                                {project.hashtags.map((tag, i) => (
                                    <span key={i} className="text-[10px] md:text-xs opacity-50 font-semibold tracking-wider uppercase">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {project.showExternalLink && project.externalLink && (
                            <div className="mt-12">
                                <a
                                    href={project.externalLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold border-b border-[#111] pb-1 hover:opacity-50 transition-opacity"
                                >
                                    ↗ Visit Project
                                </a>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Scroll indicator */}
                <div className="absolute bottom-8 flex flex-col items-center gap-3 mix-blend-difference text-white md:mix-blend-normal md:text-[#111]">
                    <motion.svg
                        width="16" height="16" viewBox="0 0 16 16" fill="none"
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="opacity-40"
                    >
                        <path d="M8 2v12M8 14l-4-4M8 14l4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                </div>
            </div>

            {/* Layout Navigator */}
            <div className="fixed bottom-8 right-8 z-50 flex items-center gap-2 bg-[#f3f3f3]/80 backdrop-blur-md rounded-full px-3 py-2 shadow-sm border border-[#111]/5">
                {([1, 4] as const).map(n => (
                    <button
                        key={n}
                        onClick={() => setCols(n)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${cols === n
                            ? 'bg-[#111] text-[#f3f3f3]'
                            : 'hover:bg-[#111]/10 text-[#111]/60'
                            }`}
                        title={`${n} column${n > 1 ? 's' : ''}`}
                    >
                        {/* Grid icon */}
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            {n === 1 && (
                                <rect x="2" y="1" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.3" />
                            )}
                            {n === 4 && (
                                <>
                                    <rect x="1" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
                                    <rect x="8" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
                                    <rect x="1" y="8" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
                                    <rect x="8" y="8" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
                                </>
                            )}
                        </svg>
                    </button>
                ))}
            </div>

            {/* Media Gallery : Responsive Grid */}
            <div
                className={`px-4 md:px-12 lg:px-24 pb-32 relative z-10 ${cols === 1 ? 'space-y-6' : ''}`}
                style={cols === 4 ? {
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gap: '0.5rem',
                    transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
                } : {}}
            >
                {allMedia.map((media, i) => {
                    const isLandscape = landscapeItems[i];
                    const spanClass = (cols >= 2 && isLandscape) ? 'md:col-span-2' : '';
                    const viewClass = cols === 1
                        ? 'w-full h-[90vh] md:h-screen snap-center flex items-center justify-center'
                        : `w-full ${spanClass}`;

                    return (
                        <motion.div
                            key={i}
                            data-index={i + 1}
                            ref={(el) => { sectionRefs.current[i + 1] = el; }}
                            initial={{ opacity: 0, y: 80 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-80px' }}
                            transition={{ duration: 0.8, delay: (i % 10) * 0.05, ease: [0.25, 1, 0.5, 1] }}
                            className={`${viewClass} ${cols !== 1 ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                            onClick={() => {
                                if (cols !== 1) {
                                    setSelectedMedia(media);
                                }
                            }}
                            layout
                        >
                            {media.type === 'video' || isVideoUrl(media.url) ? (
                                <video
                                    src={media.url}
                                    controls
                                    playsInline
                                    muted
                                    onLoadedMetadata={(e) => {
                                        const target = e.target as HTMLVideoElement;
                                        if (target.videoWidth > target.videoHeight) {
                                            setLandscapeItems(prev => ({ ...prev, [i]: true }));
                                        }
                                    }}
                                    className={cols === 1 ? 'max-w-[90%] md:max-w-[75%] max-h-[65vh] md:max-h-[75vh] mx-auto object-contain drop-shadow-sm rounded-[4px]' : 'w-full h-auto object-contain rounded-[4px]'}
                                    style={cols !== 1 ? { maxHeight: '60vh' } : undefined}
                                />
                            ) : (
                                <img
                                    src={media.url}
                                    alt={`${project.title} — ${i + 1}`}
                                    loading="lazy"
                                    onLoad={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        if (target.naturalWidth > target.naturalHeight) {
                                            setLandscapeItems(prev => ({ ...prev, [i]: true }));
                                        }
                                    }}
                                    className={cols === 1 ? 'max-w-[90%] md:max-w-[75%] max-h-[65vh] md:max-h-[75vh] mx-auto object-contain drop-shadow-sm rounded-[4px]' : 'w-full h-auto drop-shadow-sm object-contain rounded-[4px]'}
                                    style={cols !== 1 ? { maxHeight: '60vh' } : undefined}
                                />
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Footer */}
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className={`border-t border-[#111]/10 px-6 md:px-16 py-12 flex justify-between items-center relative z-10 ${cols === 1 ? 'snap-center' : ''}`}
            >
                <button
                    onClick={() => navigate('/')}
                    className="text-[10px] uppercase tracking-widest font-bold opacity-60 hover:opacity-100 transition-opacity"
                >
                    Back to Home
                </button>
                <button
                    onClick={() => setContactOpen(true)}
                    className="text-[10px] uppercase tracking-widest font-bold opacity-60 hover:opacity-100 transition-opacity"
                >
                    Contact
                </button>
            </motion.div>
            <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} dark={false} />

            {/* Fullscreen Media Modal */}
            <AnimatePresence>
                {selectedMedia && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-[100] bg-[#f3f3f3]/95 backdrop-blur-md flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
                        onClick={() => setSelectedMedia(null)}
                    >
                        <button
                            onClick={() => setSelectedMedia(null)}
                            className="absolute top-6 right-6 md:top-10 md:right-10 text-[10px] uppercase tracking-widest font-bold opacity-60 hover:opacity-100 transition-opacity z-10 text-[#111]"
                        >
                            CLOSE
                        </button>

                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                            className="relative w-full h-full flex items-center justify-center pointer-events-none"
                        >
                            {selectedMedia.type === 'video' || isVideoUrl(selectedMedia.url) ? (
                                <video
                                    src={selectedMedia.url}
                                    controls
                                    autoPlay
                                    className="max-w-full max-h-full object-contain drop-shadow-2xl pointer-events-auto rounded-[8px]"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <img
                                    src={selectedMedia.url}
                                    alt="Enlarged view"
                                    className="max-w-full max-h-full object-contain drop-shadow-2xl pointer-events-auto rounded-[8px]"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
