import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion } from 'motion/react';
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

    // We'll keep the scroll refs for Hero vs Gallery navigation
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

    // Intersection Observer for detecting active slide
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

    // Build full media list
    const allMedia: MediaItem[] = [];
    if (project && project.media && project.media.length > 0) {
        allMedia.push(...project.media);
    }

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if not in an input field
            if (['TEXTAREA', 'INPUT'].includes((e.target as HTMLElement).tagName)) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = Math.min(activeIndex + 1, allMedia.length); // 0 is hero, 1..N are images
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
    }, [activeIndex, allMedia.length]);


    // Loading
    if (loading) {
        return (
            <div className="w-screen h-screen bg-[#f7f6f0] flex items-center justify-center"
                style={{ fontFamily: "'Champagne & Limousines', sans-serif" }}>
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
            <div className="w-screen h-screen bg-[#f7f6f0] flex flex-col items-center justify-center gap-4"
                style={{ fontFamily: "'Champagne & Limousines', sans-serif" }}>
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
            className="w-full h-screen overflow-y-auto overflow-x-hidden bg-[#f7f6f0] text-[#111] selection:bg-[#111] selection:text-[#f7f6f0] scroll-smooth"
            style={{ fontFamily: "'Champagne & Limousines', sans-serif" }}
        >
            <GridTrail dark={false} />

            {/* Fixed Navigation */}
            <nav className="fixed top-0 w-full flex justify-between items-center px-6 pt-4 pb-0 md:px-12 z-50 mix-blend-difference text-[#f7f6f0] md:mix-blend-normal md:text-[#111] pointer-events-none">
                <div className="flex-none pointer-events-auto">
                    <button
                        onClick={() => navigate('/')}
                        className="text-[9px] md:text-[11px] font-bold uppercase transition-opacity hover:opacity-50"
                    >
                        LEE JAEWOONG
                    </button>
                </div>
                <div className="flex-1 flex justify-end items-center gap-6 md:gap-16 pointer-events-auto">
                    <button
                        onClick={() => navigate('/freedive')}
                        className="text-[9px] md:text-[11px] font-bold uppercase transition-opacity hover:opacity-50 opacity-40"
                    >
                        FREE DIVE
                    </button>
                </div>
            </nav>

            {/* Side Navigator */}
            <div className="fixed right-6 md:right-12 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-4 mix-blend-difference text-[#f7f6f0] md:mix-blend-normal md:text-[#111] pointer-events-none">
                {/* Tracker text */}
                <div className="text-[9px] md:text-[10px] tracking-widest font-bold opacity-60" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    {activeIndex === 0 ? 'INFO' : 'GALLERY'}
                </div>
                {/* Dots */}
                <div className="flex flex-col gap-3 mt-4 pointer-events-auto">
                    {[0, 1].map((_, i) => (
                        <button
                            key={i}
                            onClick={() => sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth' })}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeIndex === i ? 'bg-current scale-150' : 'bg-current opacity-20 hover:opacity-50'}`}
                            aria-label={`Go to slide ${i}`}
                        />
                    ))}
                </div>
            </div>

            {/* Slide 0: Hero & Info */}
            <div
                data-index={0}
                ref={(el) => { sectionRefs.current[0] = el; }}
                className="w-full min-h-screen flex flex-col items-center justify-center px-6 py-20 relative z-10"
            >
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="text-center max-w-4xl px-4 md:px-12"
                >
                    <h1
                        className="text-[12vw] md:text-[8vw] leading-[0.9] tracking-tight mb-8"
                        style={{ fontWeight: 700 }}
                    >
                        {project.title}
                    </h1>
                    <div className="text-xs md:text-sm uppercase tracking-widest opacity-50 mb-12">
                        {project.year}
                    </div>
                    <p className="text-base md:text-lg leading-[2] opacity-80 text-justify max-w-2xl mx-auto">
                        {project.desc}
                    </p>

                    {project.hashtags && project.hashtags.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2 mt-8">
                            {project.hashtags.map((tag, i) => (
                                <span key={i} className="text-[10px] opacity-30 tracking-widest uppercase">
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
                                {'>'} Link
                            </a>
                        </div>
                    )}
                </motion.div>

                {/* Scroll indicator */}
                <div className="absolute bottom-8 flex flex-col items-center gap-3">
                    <motion.svg
                        width="16" height="16" viewBox="0 0 16 16" fill="none"
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="opacity-30"
                    >
                        <path d="M8 2v12M8 14l-4-4M8 14l4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                </div>
            </div>

            {/* Layout Navigator */}
            <div className="fixed bottom-8 right-8 z-50 flex items-center gap-2 bg-[#f7f6f0]/80 backdrop-blur-md rounded-full px-3 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-[#111]/10">
                {([1, 4] as const).map(n => (
                    <button
                        key={n}
                        onClick={() => setCols(n)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${cols === n
                            ? 'bg-[#111] text-[#f7f6f0]'
                            : 'hover:bg-[#111]/10 text-[#111]/50'
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
                data-index={1}
                ref={(el) => { sectionRefs.current[1] = el; }}
                className="px-4 md:px-12 lg:px-24 pb-32 relative z-10"
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gap: cols === 1 ? '1.5rem' : '0.5rem',
                    transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
            >
                {allMedia.map((media, i) => {
                    const isLandscape = landscapeItems[i];
                    // If image is landscape and columns configured >= 2, span 2 columns
                    const spanClass = (cols >= 2 && isLandscape) ? 'md:col-span-2' : '';

                    return (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 80 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-80px' }}
                            transition={{ duration: 0.8, delay: (i % 10) * 0.05, ease: [0.25, 1, 0.5, 1] }}
                            className={`w-full ${spanClass}`}
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
                                    className="w-full h-auto"
                                    style={{ objectFit: 'contain', maxHeight: '85vh' }}
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
                                    className="w-full h-auto drop-shadow-sm"
                                    style={{ objectFit: 'contain', maxHeight: '85vh' }}
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
                className="border-t border-[#111]/10 px-6 md:px-16 py-12 flex justify-between items-center relative z-10"
            >
                <button
                    onClick={() => navigate('/')}
                    className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                >
                    Back to Home
                </button>
                <button
                    onClick={() => setContactOpen(true)}
                    className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                >
                    Contact
                </button>
            </motion.div>
            <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} />
        </div>
    );
}
