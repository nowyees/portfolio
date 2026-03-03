import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { getAllProjects, type Project } from '../../lib/portfolioService';

export default function FreeDive() {
    const navigate = useNavigate();
    const [mediaItems, setMediaItems] = useState<{ id: string, url: string, type: 'video' | 'image', x: number, y: number, width: number, aspect: string }[]>([]);

    // Canvas panning state
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Smooth spring physics for panning (gives that underwater glide feel)
    const springConfig = { damping: 25, stiffness: 120, mass: 0.5 };
    const smoothX = useSpring(x, springConfig);
    const smoothY = useSpring(y, springConfig);

    useEffect(() => {
        // Prevent default body scrolling while on this page
        document.body.style.overflow = 'hidden';

        // Fetch `freedive` projects and map their media
        getAllProjects().then(projects => {
            const freeDiveProjects = projects.filter(p => p.category === 'freedive');
            let extracted: { id: string, url: string, type: 'video' | 'image', x: number, y: number, width: number, aspect: string }[] = [];

            // We extract all images and media from the freedive projects
            freeDiveProjects.forEach((project, pIdx) => {
                // Main project image
                if (project.image) {
                    extracted.push({
                        id: `p-${project.id}-main`,
                        url: project.image,
                        type: 'image',
                        x: Math.random() * 3000 - 1500, // Random X between -1500 and +1500
                        y: Math.random() * 2000 - 1000, // Random Y between -1000 and +1000
                        width: Math.random() * 300 + 200, // Random width between 200px and 500px
                        aspect: project.aspect || '1',
                    });
                }

                // Additional media
                if (project.media && project.media.length > 0) {
                    project.media.forEach((m, mIdx) => {
                        extracted.push({
                            id: `p-${project.id}-m-${mIdx}`,
                            url: m.url,
                            type: m.type,
                            x: Math.random() * 4000 - 2000,
                            y: Math.random() * 3000 - 1500,
                            width: Math.random() * 250 + 150,
                            aspect: '1' // Defaulting to squareish if not provided for generic media
                        });
                    });
                }
            });

            // If no valid items (empty init state), spread some dummy shapes or leave empty.
            setMediaItems(extracted);
        });

        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    // Handle Wheel Events for Panning
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const panSpeed = 1.5;
        // Moving the wheel down (positive deltaY) moves the canvas UP (negative Y)
        x.set(x.get() - e.deltaX * panSpeed);
        y.set(y.get() - e.deltaY * panSpeed);
    };

    // Handle Keydown Events for Panning
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const step = 100;
            switch (e.key) {
                case 'ArrowUp':
                    y.set(y.get() + step);
                    break;
                case 'ArrowDown':
                    y.set(y.get() - step);
                    break;
                case 'ArrowLeft':
                    x.set(x.get() + step);
                    break;
                case 'ArrowRight':
                    x.set(x.get() - step);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [x, y]);

    return (
        <div
            className="relative w-screen h-screen bg-white overflow-hidden text-[#111] selection:bg-[#111] selection:text-white"
            style={{ fontFamily: "'Champagne & Limousines', sans-serif" }}
            onWheel={handleWheel}
        >
            {/* Fixed Navigation */}
            <nav className="absolute top-0 w-full flex justify-between items-center px-6 pt-4 pb-0 md:px-12 pointer-events-auto z-50">
                <div className="flex-none">
                    <button onClick={() => navigate('/')} className="text-[9px] md:text-[11px] font-bold uppercase transition-opacity hover:opacity-50">LEE JAEWOONG</button>
                </div>
                <div className="flex-1 flex justify-end items-center gap-6 md:gap-16">
                    <button className="text-[9px] md:text-[11px] font-bold uppercase transition-opacity hover:opacity-50 opacity-40">FREE DIVE</button>
                </div>
            </nav>

            {/* Helper text overlay */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 text-center pointer-events-none opacity-30 mix-blend-difference">
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#111] bg-white/50 px-4 py-2 rounded-full backdrop-blur-sm">
                    Drag, Scroll, or Arrow Keys to Explore
                </span>
            </div>

            {/* Infinite Canvas */}
            <motion.div
                className="w-full h-full cursor-grab active:cursor-grabbing"
                drag
                dragMomentum={true}
                style={{ x: smoothX, y: smoothY }}
                onDrag={(event, info) => {
                    // We keep the spring updated natively via Framer Motion's `drag`
                    // But we need to sync the raw x/y values so wheel and keys don't reset tracking
                    x.set(x.get() + info.delta.x);
                    y.set(y.get() + info.delta.y);
                }}
            // We use an absolutely huge invisible div to ensure drag surface covers everything bounds-free
            >
                <div className="absolute top-1/2 left-1/2 w-[10000px] h-[10000px] -translate-x-1/2 -translate-y-1/2 origin-center">
                    {mediaItems.length === 0 ? (
                        // State if DB is empty
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center opacity-20">
                            <p className="text-4xl font-bold uppercase tracking-widest">Free Dive</p>
                            <p className="mt-4 text-sm font-sans tracking-widest">Upload files to the 'freedive' category in Admin panel to see them float here.</p>
                        </div>
                    ) : (
                        // Floating Media
                        mediaItems.map((item) => {
                            return (
                                <motion.div
                                    key={item.id}
                                    className="absolute shadow-sm hover:shadow-xl transition-shadow duration-500 bg-[#f7f6f0] overflow-hidden"
                                    style={{
                                        // Place relative to the massive 10000x10000 center anchor
                                        left: `calc(50% + ${item.x}px)`,
                                        top: `calc(50% + ${item.y}px)`,
                                        width: item.width,
                                        // Aspect ratio hack if string is e.g 'aspect-[4/3]' -> we compute padding or use CSS native
                                        aspectRatio: item.aspect.includes('aspect-[')
                                            ? item.aspect.replace('aspect-[', '').replace(']', '')
                                            : 'auto',
                                    }}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 1, delay: Math.random() * 0.5 }}
                                >
                                    {item.type === 'video' ? (
                                        <video
                                            src={item.url}
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                            className="w-full h-full object-cover pointer-events-none"
                                        />
                                    ) : (
                                        <img
                                            src={item.url}
                                            alt=""
                                            className="w-full h-full object-cover pointer-events-none"
                                            loading="lazy"
                                        />
                                    )}
                                </motion.div>
                            )
                        })
                    )}
                </div>
            </motion.div>
        </div>
    );
}
