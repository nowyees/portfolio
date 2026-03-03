import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { getAllProjects } from '../../lib/portfolioService';

const CELL_W = 460;
const CELL_H = 640;

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
        getAllProjects().then(projects => {
            const freeDiveProjects = projects.filter(p => p.category === 'freedive');
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

    // Camera current state (lerped)
    const [camera, setCamera] = useState({ x: 0, y: 0, z: 3.0 });
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

    // Animation loop
    useEffect(() => {
        let frame: number;
        const tick = () => {
            setCamera(prev => {
                const dx = tX.current - prev.x;
                const dy = tY.current - prev.y;
                const dz = tZ.current - prev.z;

                // Stop rendering strictly if we're super close, saves CPU
                if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 && Math.abs(dz) < 0.001) {
                    return prev;
                }

                return {
                    x: prev.x + dx * 0.08, // 0.08 is lerp speed
                    y: prev.y + dy * 0.08,
                    z: prev.z + dz * 0.08
                };
            });
            frame = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(frame);
    }, []);

    // Interaction handlers
    const handleWheel = (e: React.WheelEvent) => {
        let zoomDelta = 0;
        if (e.ctrlKey || e.metaKey) {
            zoomDelta = e.deltaY * -0.01;
        } else {
            zoomDelta = e.deltaY * -0.002;
        }

        let newZoom = tZ.current * (1 + zoomDelta);
        newZoom = Math.max(0.1, Math.min(newZoom, 5.0)); // Clamp scale
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
    const vLeft = -camera.x - (screen.w / 2) / camera.z;
    const vRight = -camera.x + (screen.w / 2) / camera.z;
    const vTop = -camera.y - (screen.h / 2) / camera.z;
    const vBottom = -camera.y + (screen.h / 2) / camera.z;

    const startCol = Math.floor(vLeft / blockW) - 1;
    const endCol = Math.floor(vRight / blockW) + 1;
    const startRow = Math.floor(vTop / blockH) - 1;
    const endRow = Math.floor(vBottom / blockH) + 1;

    const visibleItems: any[] = [];
    if (mediaItems.length > 0) {
        for (let bc = startCol; bc <= endCol; bc++) {
            for (let br = startRow; br <= endRow; br++) {
                const blockOffsetX = bc * blockW;
                const blockOffsetY = br * blockH;

                mediaItems.forEach((item, index) => {
                    const localCol = index % cols;
                    const localRow = Math.floor(index / cols);

                    const itemX = blockOffsetX + localCol * CELL_W + CELL_W / 2;
                    const itemY = blockOffsetY + localRow * CELL_H + CELL_H / 2;

                    // Generate a stable pseudo-random aspect and scale based on index to make them look free-flowing
                    const pseudoRandom = (Math.sin(index * 12.9898 + 78.233) * 43758.5453) % 1;
                    const scale = 0.6 + Math.abs(pseudoRandom) * 0.6; // between 0.6 and 1.2
                    const isPortrait = Math.abs(pseudoRandom) > 0.5;
                    const aspect = isPortrait ? (3 / 4) : (16 / 9);

                    visibleItems.push({
                        key: `${bc}-${br}-${item.id}`,
                        item,
                        x: itemX,
                        y: itemY,
                        width: (CELL_W - 60) * scale,
                        height: (CELL_W - 60) * scale / aspect
                    });
                });
            }
        }
    }

    // Video Player Component to handle individual play states without rerendering the whole canvas
    const VideoItem = ({ src }: { src: string }) => {
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
                className="w-full h-full relative cursor-pointer"
                onClick={(e) => {
                    // Prevent canvas drag from triggering click if they only meant to drag
                    if (!isDragging.current) togglePlay();
                }}
            >
                <video
                    ref={videoRef}
                    src={src}
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover pointer-events-none opacity-90 transition-opacity duration-300"
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
            className="fixed inset-0 bg-[#f7f6f0] text-[#111] touch-none select-none overflow-hidden"
            style={{ fontFamily: "'Champagne & Limousines', sans-serif" }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {/* Header / Nav */}
            <nav className="absolute top-0 w-full flex justify-between items-center px-6 pt-4 pb-0 md:px-12 pointer-events-auto z-50">
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
                className="absolute top-1/2 left-1/2 origin-center"
                style={{
                    transform: `translate(-50%, -50%) scale(${camera.z}) translate(${camera.x}px, ${camera.y}px)`,
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
                            className="absolute bg-[#FFF] shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden flex items-center justify-center"
                            style={{
                                width: renderData.width,
                                height: renderData.height,
                                left: renderData.x,
                                top: renderData.y,
                                transform: 'translate(-50%, -50%)',
                                willChange: 'transform'
                            }}
                        >
                            {renderData.item.type === 'video' ? (
                                <VideoItem src={renderData.item.url} />
                            ) : (
                                <img
                                    src={renderData.item.url}
                                    alt=""
                                    loading="lazy"
                                    className="w-full h-full object-cover pointer-events-none opacity-90 hover:opacity-100 transition-opacity duration-300"
                                />
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
