import React, { useState, useEffect } from 'react';
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
    const [cols, setCols] = useState<1 | 2 | 4>(1);

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

    // Build full media list: main image + extra media
    const allMedia: MediaItem[] = [{ url: project.image, type: 'image' }];
    if (project.media && project.media.length > 0) {
        allMedia.push(...project.media);
    }

    return (
        <div
            className="min-h-screen bg-[#f7f6f0] text-[#111] selection:bg-[#111] selection:text-[#f7f6f0]"
            style={{ fontFamily: "'Champagne & Limousines', sans-serif" }}
        >
            <GridTrail dark={false} />

            {/* Fixed Navigation */}
            <nav className="fixed top-0 w-full flex justify-between items-center px-6 pt-4 pb-0 md:px-12 z-50 mix-blend-difference text-[#f7f6f0] md:mix-blend-normal md:text-[#111]">
                <div className="flex-none">
                    <button
                        onClick={() => navigate('/')}
                        className="text-[9px] md:text-[11px] font-bold uppercase transition-opacity hover:opacity-50"
                    >
                        LEE JAEWOONG
                    </button>
                </div>
                <div className="flex-1 flex justify-end items-center gap-6 md:gap-16">
                    <button
                        onClick={() => navigate('/freedive')}
                        className="text-[9px] md:text-[11px] font-bold uppercase transition-opacity hover:opacity-50 opacity-40"
                    >
                        FREE DIVE
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="h-screen flex flex-col items-center justify-center px-6 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 1, 0.5, 1] }}
                    className="text-center max-w-3xl"
                >
                    <h1
                        className="text-[12vw] md:text-[8vw] leading-[0.9] tracking-tight"
                        style={{ fontWeight: 700 }}
                    >
                        {project.title}
                    </h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        className="mt-6 text-xs md:text-sm uppercase tracking-widest"
                    >
                        {project.year}
                    </motion.p>
                </motion.div>

                {/* Scroll indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 1.2 }}
                    className="absolute bottom-12 flex flex-col items-center gap-3"
                >
                    <motion.svg
                        width="16" height="16" viewBox="0 0 16 16" fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="opacity-30"
                    >
                        <path d="M8 2v12M8 14l-4-4M8 14l4-4" stroke="#111" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                    <span className="text-[9px] uppercase tracking-widest opacity-30">Scroll to explore</span>
                </motion.div>
            </div>

            {/* Project Description */}
            <motion.div
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
                className="max-w-3xl mx-auto px-6 md:px-16 py-20 relative z-10"
            >
                <p className="text-base md:text-lg lg:text-xl leading-[2] opacity-80 text-justify">
                    {project.desc}
                </p>
                {project.showExternalLink && project.externalLink && (
                    <div className="mt-10">
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

            {/* Layout Navigator */}
            <div className="fixed bottom-8 right-8 z-50 flex items-center gap-2 bg-white/80 backdrop-blur-md rounded-full px-3 py-2 shadow-lg border border-[#111]/10">
                {([1, 2, 4] as const).map(n => (
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
                            {n === 2 && (
                                <>
                                    <rect x="1" y="1" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.3" />
                                    <rect x="8" y="1" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.3" />
                                </>
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

            {/* Media Gallery — Responsive Grid */}
            <div
                className="px-4 md:px-12 lg:px-24 pb-32 relative z-10"
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gap: cols === 1 ? '2.5rem' : cols === 2 ? '1.5rem' : '1rem',
                    transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
            >
                {allMedia.map((media, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 80 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.8, delay: i * 0.05, ease: [0.25, 1, 0.5, 1] }}
                        className="w-full"
                        layout
                    >
                        {media.type === 'video' || isVideoUrl(media.url) ? (
                            <video
                                src={media.url}
                                controls
                                playsInline
                                muted
                                className="w-full h-auto bg-black/5"
                                style={{ objectFit: 'contain', maxHeight: '85vh' }}
                            />
                        ) : (
                            <img
                                src={media.url}
                                alt={`${project.title} — ${i + 1}`}
                                loading="lazy"
                                className="w-full h-auto bg-black/5"
                                style={{ objectFit: 'contain', maxHeight: '85vh' }}
                            />
                        )}
                    </motion.div>
                ))}
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
