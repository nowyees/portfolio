import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { getPortfolioByCategory } from '../../lib/portfolioService';

const CELL_W = 1120;
const CELL_H = 1300;

export default function FreeDive() {
    const navigate = useNavigate();
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [screen, setScreen] = useState({ w: window.innerWidth, h: window.innerHeight });

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
    const lastInteractionTime = useRef(performance.now());
    const [landingDone, setLandingDone] = useState(false);

    // Slide-up + zoom-out/zoom-in landing animation
    useEffect(() => {
        // Start zoomed in
        tZ.current = 2.5;
        cZ.current = 2.5;

        // Zoom out after slide-up completes
        const t1 = setTimeout(() => {
            tZ.current = 0.55;
        }, 600);

        // Zoom back in to normal
        const t2 = setTimeout(() => {
            tZ.current = 1.0;
        }, 1600);

        // Mark landing done
        const t3 = setTimeout(() => setLandingDone(true), 2400);

        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, []);

    // Animation loop (optimized natively, bypassing React lifecycle)
    useEffect(() => {
        let frame: number;
        const tick = () => {
            let changed = false;
            // Screensaver Drift: If no interaction for 3 seconds, slowly pan
            const now = performance.now();
            if (now - lastInteractionTime.current > 3000 && !isDragging.current && landingDone) {
                // Drift logic
                tX.current -= 0.8 / cZ.current;
                tY.current -= 0.6 / cZ.current;
            }

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
    const markInteraction = () => { lastInteractionTime.current = performance.now(); };

    const handleWheel = (e: React.WheelEvent) => {
        markInteraction();
        let zoomDelta = 0;
        if (e.ctrlKey || e.metaKey) {
            zoomDelta = e.deltaY * -0.01;
        } else {
            zoomDelta = e.deltaY * -0.002;
        }

        let newZoom = tZ.current * (1 + zoomDelta);
        newZoom = Math.max(0.35, Math.min(newZoom, 5.0));
        tZ.current = newZoom;
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        markInteraction();
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        isDragging.current = true;
        lastPan.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        markInteraction();
        const dx = e.clientX - lastPan.current.x;
        const dy = e.clientY - lastPan.current.y;
        lastPan.current = { x: e.clientX, y: e.clientY };

        tX.current += dx / tZ.current;
        tY.current += dy / tZ.current;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        markInteraction();
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // Keyboard panning
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            markInteraction();
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

                    visibleItems.push({
                        key: `${bc}-${br}-${item.id}`,
                        item,
                        x: itemX,
                        y: itemY,
                        width: 520
                    });
                });
            }
        }
    }

    const handleItemClick = (x: number, y: number) => {
        markInteraction();
        if (!isDragging.current) {
            tX.current = -x;
            tY.current = -y;
            // 1.15 zoom leaves vertical padding above and below the CELL_H
            tZ.current = 1.15;
        }
    };

    // Video Player Component to handle individual play states without rerendering the whole canvas
    const VideoItem = ({ src, onClick }: { src: string, onClick: () => void }) => {
        const [isPlaying, setIsPlaying] = useState(false);
        const [tilt, setTilt] = useState({ x: 0, y: 0 });
        const videoRef = useRef<HTMLVideoElement>(null);
        const containerRef = useRef<HTMLDivElement>(null);

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

        const handleMouseMove = (e: React.MouseEvent) => {
            if (!containerRef.current) return;
            // Disable tilt on touch devices to prevent lag
            if (typeof window !== 'undefined' && 'ontouchstart' in window) return;

            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const xPct = x / rect.width;
            const yPct = y / rect.height;
            // Max tilt of 10 degrees
            setTilt({ x: (yPct - 0.5) * -20, y: (xPct - 0.5) * 20 });
        };

        return (
            <div
                ref={containerRef}
                className="w-full h-auto relative cursor-pointer"
                style={{
                    perspective: '1000px',
                    transformStyle: 'preserve-3d',
                }}
                onClick={(e) => {
                    e.stopPropagation(); // prevent bubbling to canvas if we had any
                    if (!isDragging.current) {
                        togglePlay();
                        onClick(); // Trigger camera centering
                    }
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setTilt({ x: 0, y: 0 })}
            >
                <video
                    ref={videoRef}
                    src={src}
                    loop
                    muted
                    playsInline
                    className="w-full h-auto transition-transform duration-[400ms] ease-out block rounded-sm pointer-events-none"
                    style={{
                        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.x || tilt.y ? 1.05 : 1})`,
                        opacity: 1
                    }}
                />
                {!isPlaying && (
                    <div
                        className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none transition-transform duration-[400ms]"
                        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.x || tilt.y ? 1.05 : 1}) translateZ(30px)` }}
                    >
                        <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg">
                            <span className="text-white ml-1 text-xl">▶</span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const ImageItem = ({ src, onClick }: { src: string, onClick: (e: React.MouseEvent) => void }) => {
        const [tilt, setTilt] = useState({ x: 0, y: 0 });
        const containerRef = useRef<HTMLDivElement>(null);

        const handleMouseMove = (e: React.MouseEvent) => {
            if (!containerRef.current) return;
            // Prevent interference from drag interaction state
            if (isDragging.current) return setTilt({ x: 0, y: 0 });
            // Disable tilt on touch devices to prevent lag
            if (typeof window !== 'undefined' && 'ontouchstart' in window) return;

            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const xPct = x / rect.width;
            const yPct = y / rect.height;
            // Max tilt 15 degrees
            setTilt({ x: (yPct - 0.5) * -30, y: (xPct - 0.5) * 30 });
        };

        return (
            <div
                ref={containerRef}
                className="w-full h-full relative"
                style={{ perspective: '1200px' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setTilt({ x: 0, y: 0 })}
            >
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick(e);
                    }}
                    className="w-full h-full pointer-events-auto cursor-pointer block bg-[#e5e4de] rounded-sm transition-transform duration-[400ms] ease-out shadow-[0_15px_35px_rgba(0,0,0,0.15)]"
                    style={{
                        aspectRatio: '3/4',
                        objectFit: 'cover',
                        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.x || tilt.y ? 1.08 : 1})`,
                    }}
                />
            </div>
        );
    };

    return (
        <div
            className="fixed inset-0 bg-[#f7f6f0] text-[#111] select-none overflow-hidden"
            style={{
                fontFamily: "'Champagne & Limousines', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                animation: 'slideUpIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            }}
        >
            {/* Canvas drag surface */}
            <div
                className="absolute inset-0 touch-none z-0"
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            />

            {/* Header / Nav */}
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
                {visibleItems.map(renderData => (
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
                            <ImageItem
                                src={renderData.item.url}
                                onClick={(e) => handleItemClick(renderData.x, renderData.y)}
                            />
                        )}
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes slideUpIn {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
