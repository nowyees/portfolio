import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function FreeDive() {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="relative w-screen h-screen bg-[#f7f6f0] overflow-hidden font-sans flex flex-col items-center justify-center">
            <nav className="absolute top-0 w-full flex justify-between items-center px-6 pt-4 pb-0 md:px-12 pointer-events-auto z-50">
                <div className="flex-none">
                    <button onClick={() => navigate('/')} className="text-[7px] md:text-[9px] font-bold md:font-medium uppercase tracking-wider md:tracking-widest">LEE JAEWOONG</button>
                </div>
                <div className="flex-1 flex justify-end items-center gap-6 md:gap-16">
                    <button className="text-[7px] md:text-[9px] font-bold md:font-medium uppercase tracking-widest text-[#111]">FREE DIVE</button>
                </div>
            </nav>

            <div className="text-center text-[#111] opacity-50 mt-12">
                <p className="text-xl md:text-2xl font-bold uppercase tracking-widest mb-4">FREE DIVE</p>
                <p className="text-xs md:text-sm tracking-widest">Coming Soon: Floating projects and media.</p>
                <button onClick={() => navigate('/')} className="mt-8 text-[9px] uppercase tracking-widest border-b border-[#111] pb-1 hover:opacity-100 transition-opacity">Back to Home</button>
            </div>
        </div>
    );
}
