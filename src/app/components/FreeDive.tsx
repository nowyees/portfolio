import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { getPortfolioByCategory } from '../../lib/portfolioService';

const CELL_W = 460;
const CELL_H = 640;

export default function FreeDive() {
    const navigate = useNavigate();
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [screen, setScreen] = useState({ w: window.innerWidth, h: window.innerHeight });
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    // Handle screen resize
    useEffect(() => {
        const updateScreen = () => setScreen({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', updateScreen);
        return () => window.removeEventListener('resize', updateScreen);
    }, []);

    // Fetch projects
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        getPortfolioByCategory('freedive').then(categoryData => {
            if (!categoryData) {
                setMediaItems([]);
                return;
            }
            const freeDiveProjects = categoryData.projects;
            let extracted: any[] = [];
            freeDiveProjects.forEach((project) => {
                if (project.image) extracted.push({ id: `p-${project.id}-main`, url: project.image, type: 'image' });
                if (project.media && project.media.length > 0) {
                    project.media.forEach((m, mIdx) => {
                        extracted.push({ id: `p-${project.id}-m-${mIdx}`, url: m.url, type: m.type });
                    });
                }
            });
            setMediaItems(extracted);
        });
        return () => { document.body.style.overflow = 'auto'; };
    }, []);

    // Layout math
    // Instead of forcing strict bounds, we will give each item a random aspect ratio and size if not provided
    // and arrange them in a loose grid.
    const cols = Math.max(1, Math.ceil(Math.sqrt(mediaItems.length)));
    const rows = Math.ceil(mediaItems.length / cols) || 1;
    const blockW = cols * CELL_W;
    const blockH = rows * CELL_H;

    // Camera targets
    const tX = useRef(0);
    const tY = useRef(0);
    const tZ = useRef(3.0); // Start deeply zoomed in

    // Camera current state (NOT lerped via React state to save CPU)
    const cX = useRef(0);
    const cY = useRef(0);
    const cZ = useRef(3.0);
    const canvasRef = useRef<HTMLDivElement>(null);
    const lastBounds = useRef({ startCol: -2, endCol: 2, startRow: -2, endRow: 2 });
    const [visibleBounds, setVisibleBounds] = useState({ startCol: -1, endCol: 1, startRow: -1, endRow: 1 });
    const isDragging = useRef(false);
    const lastPan = useRef({ x: 0, y: 0 });

    // Initial landing animation (Zoom out, then zoom in)
    useEffect(() => {
        // Quickly zoom out
        tZ.current = 0.3;

        // After 1.5 seconds, zoom into normal level
        const timer = setTimeout(() => {
            tZ.current = 1.0;
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    // Animation loop (optimized natively, bypassing React lifecycle)
    useEffect(() => {
        let frame: number;
        const tick = () => {
            let changed = false;
            const dx = tX.current - cX.current;
            const dy = tY.current - cY.current;
            const dz = tZ.current - cZ.current;

            if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || Math.abs(dz) > 0.001) {
                cX.current += dx * 0.08; // lerp speed
                cY.current += dy * 0.08;
                cZ.current += dz * 0.08;

                if (canvasRef.current) {
                    canvasRef.current.style.transform = `translate(-50%, -50%) scale(${cZ.current}) translate(${cX.current}px, ${cY.current}px)`;
                }
                changed = true;
            }

            // Always check bounds in case screen resized or jump occurred
            const sW = window.innerWidth;
            const sH = window.innerHeight;
            const vL = -cX.current - (sW / 2) / cZ.current;
            const vR = -cX.current + (sW / 2) / cZ.current;
            const vT = -cY.current - (sH / 2) / cZ.current;
            const vB = -cY.current + (sH / 2) / cZ.current;

            const sc = Math.floor(vL / blockW) - 1;
            const ec = Math.floor(vR / blockW) + 1;
            const sr = Math.floor(vT / blockH) - 1;
            const er = Math.floor(vB / blockH) + 1;

            const prev = lastBounds.current;
            if (sc !== prev.startCol || ec !== prev.endCol || sr !== prev.startRow || er !== prev.endRow) {
                const nb = { startCol: sc, endCol: ec, startRow: sr, endRow: er };
                lastBounds.current = nb;
                setVisibleBounds(nb);
            }

            frame = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(frame);
    }, [blockW, blockH]);

    // Interaction handlers
    const handleWheel = (e: React.WheelEvent) => {
        let zoomDelta = 0;
        if (e.ctrlKey || e.metaKey) {
            zoomDelta = e.deltaY * -0.01;
        } else {
            zoomDelta = e.deltaY * -0.002;
        }

        let newZoom = tZ.current * (1 + zoomDelta);
        // Limit zoom out so we don't see more than ~10-15 items at once 
        // 0.35 is roughly 3x3 or 4x3 items depending on screen size
        newZoom = Math.max(0.35, Math.min(newZoom, 5.0));
        tZ.current = newZoom;
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        // Only trigger drag for primary buttons (mostly left click/touch)
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        isDragging.current = true;
        lastPan.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastPan.current.x;
        const dy = e.clientY - lastPan.current.y;
        lastPan.current = { x: e.clientX, y: e.clientY };

        // Move camera in opposite direction of drag, scaled by zoom
        tX.current += dx / tZ.current;
        tY.current += dy / tZ.current;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // Keyboard panning
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const step = 60 / tZ.current;
            switch (e.key) {
                case 'ArrowUp': tY.current += step; break;
                case 'ArrowDown': tY.current -= step; break;
                case 'ArrowLeft': tX.current += step; break;
                case 'ArrowRight': tX.current -= step; break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Visible blocks calculation
    const visibleItems: any[] = [];
    if (mediaItems.length > 0) {
        for (let bc = visibleBounds.startCol; bc <= visibleBounds.endCol; bc++) {
            for (let br = visibleBounds.startRow; br <= visibleBounds.endRow; br++) {
                const blockOffsetX = bc * blockW;
                const blockOffsetY = br * blockH;

                mediaItems.forEach((item, index) => {
                    const localCol = index % cols;
                    const localRow = Math.floor(index / cols);

                    const itemX = blockOffsetX + localCol * CELL_W + CELL_W / 2;
                    const itemY = blockOffsetY + localRow * CELL_H + CELL_H / 2;

                    // Generate a stable pseudo-random scale based on index to make them look free-flowing
                    const pseudoRandom = (Math.sin(index * 12.9898 + 78.233) * 43758.5453) % 1;
                    const scale = 0.6 + Math.abs(pseudoRandom) * 0.6; // between 0.6 and 1.2

                    visibleItems.push({
                        key: `${bc}-${br}-${item.id}`,
                        item,
                        x: itemX,
                        y: itemY,
                        width: (CELL_W - 60) * scale
                    });
                });
            }
        }
    }

    const handleItemClick = (x: number, y: number, url?: string) => {
        if (!isDragging.current) {
            // Center camera on this item
            tX.current = -x;
            tY.current = -y;
            // Optionally zoom in slightly
            tZ.current = Math.max(1.5, tZ.current);
            // Open lightbox if url provided
            if (url) {
                setZoomedImage(url);
            }
        }
    };

    // Video Player Component to handle individual play states without rerendering the whole canvas
    const VideoItem = ({ src, onClick }: { src: string, onClick: () => void }) => {
        const [isPlaying, setIsPlaying] = useState(false);
        const videoRef = useRef<HTMLVideoElement>(null);

        const togglePlay = () => {
            if (videoRef.current) {
                if (isPlaying) {
                    videoRef.current.pause();
                } else {
                    videoRef.current.play();
                }
                setIsPlaying(!isPlaying);
            }
        };

        return (
            <div
                className="w-full h-auto relative cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation(); // prevent bubbling to canvas if we had any
                    if (!isDragging.current) {
                        togglePlay();
                        onClick(); // Trigger camera centering
                    }
                }}
            >
                <video
                    ref={videoRef}
                    src={src}
                    loop
                    muted
                    playsInline
                    className="w-full h-auto pointer-events-none opacity-90 transition-opacity duration-300 block"
                    style={{ opacity: isPlaying ? 1 : 0.8 }}
                />
                {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                            <span className="text-white ml-1 text-xl">▶</span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            className="fixed inset-0 bg-[#f7f6f0] text-[#111] select-none overflow-hidden"
            style={{ fontFamily: "'Champagne & Limousines', sans-serif" }}
        >
            {/* Canvas drag surface — sits behind nav */}
            <div
                className="absolute inset-0 touch-none z-0"
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            />

            {/* Header / Nav — on top, pointer events fully independent */}
            <nav className="absolute top-0 w-full flex justify-between items-center px-6 pt-4 pb-0 md:px-12 z-50">
                <div className="flex-none">
                    <button onClick={() => navigate('/')} className="text-[9px] md:text-[11px] font-bold uppercase transition-opacity hover:opacity-50">LEE JAEWOONG</button>
                </div>
                <div className="flex-1 flex justify-end items-center gap-6 md:gap-16">
                    <button className="text-[9px] md:text-[11px] font-bold uppercase transition-opacity hover:opacity-50 opacity-40">FREE DIVE</button>
                </div>
            </nav>

            {/* Helper overlay */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 text-center pointer-events-none opacity-40 mix-blend-multiply">
                <span className="text-[9px] uppercase font-bold tracking-[0.2em] px-4 py-2">
                    Drag, Scroll Wheel, or Arrow Keys
                </span>
            </div>

            {/* Virtual Canvas */}
            <div
                ref={canvasRef}
                className="absolute top-1/2 left-1/2 origin-center z-10"
                style={{
                    transform: `translate(-50%, -50%) scale(${cZ.current}) translate(${cX.current}px, ${cY.current}px)`,
                    willChange: 'transform'
                }}
            >
                {mediaItems.length === 0 ? (
                    <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 text-center opacity-30 mt-[-20px]">
                        <p className="text-2xl tracking-[0.2em] font-bold uppercase">FREE DIVE</p>
                        <p className="mt-2 text-[10px] tracking-widest">Awaiting Media...</p>
                    </div>
                ) : (
                    visibleItems.map(renderData => (
                        <div
                            key={renderData.key}
                            className="absolute bg-transparent shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
                            style={{
                                width: renderData.width,
                                height: 'auto',
                                left: renderData.x,
                                top: renderData.y,
                                transform: 'translate(-50%, -50%)',
                                willChange: 'transform'
                            }}
                        >
                            {renderData.item.type === 'video' ? (
                                <VideoItem
                                    src={renderData.item.url}
                                    onClick={() => handleItemClick(renderData.x, renderData.y)}
                                />
                            ) : (
                                <img
                                    src={renderData.item.url}
                                    alt=""
                                    loading="lazy"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleItemClick(renderData.x, renderData.y, renderData.item.url);
                                    }}
                                    className="w-full h-auto pointer-events-auto cursor-pointer opacity-90 hover:opacity-100 transition-opacity duration-300 block bg-black/5"
                                />
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Lightbox Overlay */}
            {zoomedImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center cursor-pointer"
                    onClick={() => setZoomedImage(null)}
                >
                    <button
                        onClick={() => setZoomedImage(null)}
                        className="absolute top-6 right-6 md:top-8 md:right-12 text-[10px] uppercase tracking-widest text-white/60 hover:text-white transition-colors z-10"
                    >
                        Close
                    </button>
                    <img
                        src={zoomedImage}
                        alt=""
                        className="max-w-[90vw] max-h-[85vh] object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
