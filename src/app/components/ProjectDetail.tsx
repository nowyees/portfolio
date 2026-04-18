import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import ContactDialog from './ContactDialog';
import { getAllProjects, type Project, type MediaItem } from '../../lib/portfolioService';
import { isVideoUrl } from '../../lib/storageService';

export default function ProjectDetail() {
    const { category, id } = useParams();
    const navigate = useNavigate();

    const [project, setProject] = useState<(Project & { category: string }) | null>(null);
    const [allProjects, setAllProjects] = useState<Array<Project & { category: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [contactOpen, setContactOpen] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

    useEffect(() => {
        window.scrollTo(0, 0);
        setLoading(true);
        getAllProjects().then(res => {
            setAllProjects(res);
            const found = res.find(p => String(p.id) === id && p.category === category);
            setProject(found || null);
            setLoading(false);
        });
    }, [category, id]);

    // Keep home page scroll memory in sync
    useEffect(() => {
        if (project) {
            sessionStorage.setItem('lastActiveProject', `${project.category}-${project.id}`);
        }
    }, [project]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedMedia) {
                setSelectedMedia(null);
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [selectedMedia]);

    if (loading) {
        return (
            <div className="w-screen h-screen bg-[#e6e6e6] flex items-center justify-center font-['Pretendard',sans-serif]">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} className="text-[10px] uppercase tracking-widest text-[#111]/40">
                    Loading...
                </motion.div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="w-screen h-screen bg-[#e6e6e6] flex flex-col items-center justify-center gap-4 font-['Pretendard',sans-serif]">
                <p className="text-sm opacity-60">Project not found.</p>
                <button onClick={() => navigate('/')} className="text-[10px] uppercase tracking-widest underline opacity-40 hover:opacity-100 transition-opacity">
                    Go back
                </button>
            </div>
        );
    }

    const allMedia = project.media || [];

    return (
        <div className="flex flex-col md:flex-row h-screen w-full bg-[#f3f3f3] text-[#111] font-['Pretendard',sans-serif] overflow-hidden selection:bg-[#111] selection:text-[#f3f3f3]">
            {/* Left Sidebar */}
            <div className="w-full md:w-[280px] lg:w-[320px] shrink-0 bg-[#f3f3f3] border-b md:border-b-0 md:border-r border-[#111]/10 flex flex-col h-[40vh] md:h-screen z-20">

                {/* 1. Header Area: Identity */}
                <div className="px-6 py-6 md:px-8 md:py-8 shrink-0">
                    <h1 className="text-xs md:text-sm lg:text-base font-bold tracking-[-0.02em] whitespace-nowrap leading-none cursor-pointer hover:opacity-60 transition-opacity" onClick={() => navigate('/')}>
                        LEEJAEWOONG
                    </h1>
                </div>

                {/* 2. Active Project Info */}
                <div className="px-6 md:px-8 mt-2 md:mt-4 shrink-0 flex flex-col h-[140px] md:h-[200px] overflow-y-auto">
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
                        {project.title}
                    </h2>
                    <p className="text-[10px] md:text-[11px] leading-[1.65] opacity-80 whitespace-pre-wrap font-medium">
                        {project.desc}
                    </p>

                    {project.showExternalLink && project.externalLink && (
                        <div className="mt-6">
                            <a href={project.externalLink} target="_blank" rel="noopener noreferrer" className="text-[10px] uppercase tracking-widest font-bold border-b border-[#111] pb-1 hover:opacity-50 transition-opacity">
                                ↗ Visit Project
                            </a>
                        </div>
                    )}
                </div>

                {/* 3. Project Navigator List */}
                <div className="px-6 md:px-8 mt-4 md:mt-6 flex-1 overflow-y-auto pb-10 flex flex-col gap-[14px]">
                    {allProjects.map((p) => {
                        const isActive = p.id === project.id && p.category === project.category;
                        return (
                            <button
                                key={`${p.category}-${p.id}`}
                                onClick={() => {
                                    // Reset scroll to top right when switching
                                    const rightCol = document.getElementById('right-media-col');
                                    if (rightCol) rightCol.scrollTo({ top: 0, behavior: 'instant' });
                                    navigate(`/project/${p.category}/${p.id}`);
                                }}
                                className={`text-left text-[11px] md:text-[12px] tracking-wide transition-all duration-300 hover:opacity-100 ${isActive ? 'font-bold opacity-100 translate-x-1' : 'font-medium opacity-40'}`}
                            >
                                {p.title}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Right Content Area: Media Scroll */}
            <div id="right-media-col" className="flex-1 bg-transparent h-[60vh] md:h-screen overflow-y-auto relative z-10" style={{ scrollBehavior: 'smooth' }}>
                {/* Contact Button */}
                <div className="fixed md:absolute top-6 right-6 md:top-8 md:right-8 z-30 pointer-events-auto mix-blend-difference md:mix-blend-normal text-white md:text-[#111]">
                    <button onClick={() => setContactOpen(true)} className="text-xs md:text-sm lg:text-base font-bold tracking-[-0.02em] leading-none text-[#111] md:text-[#111] hover:opacity-60 transition-opacity pointer-events-auto font-['Pretendard',sans-serif]">
                        CONTACT
                    </button>
                </div>

                <div className="w-full min-h-full flex flex-col items-center pt-24 pb-32 px-0 gap-4">
                    {allMedia.length > 0 ? (
                        allMedia.map((media, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-50px' }}
                                transition={{ duration: 0.6, delay: i * 0.1 }}
                                className="w-full cursor-zoom-in"
                                onClick={() => setSelectedMedia(media)}
                            >
                                {media.type === 'video' || isVideoUrl(media.url) ? (
                                    <video src={media.url} controls muted playsInline className="w-full h-auto" />
                                ) : (
                                    <img src={media.url} alt={`${project.title} media ${i + 1}`} loading="lazy" className="w-full h-auto" />
                                )}
                            </motion.div>
                        ))
                    ) : (
                        <div className="w-full h-[50vh] flex items-center justify-center opacity-40 text-xs font-bold tracking-widest">
                            NO IMAGES
                        </div>
                    )}
                </div>
            </div>

            <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} dark={false} />

            {/* Fullscreen Media Modal */}
            <AnimatePresence>
                {selectedMedia && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-[100] bg-[#e6e6e6]/95 backdrop-blur-md flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
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
