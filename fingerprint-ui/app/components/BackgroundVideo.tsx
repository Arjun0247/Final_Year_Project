"use client";

import { useEffect, useRef } from "react";

export default function BackgroundVideo() {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = 0.8; // Slight slow motion for better effect
        }
    }, []);

    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
            <video
                ref={videoRef}
                autoPlay
                loop
                muted
                playsInline
                className="absolute w-full h-full object-cover opacity-700 mix-blend-overlay"
            >
                <source src="/background.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-[#050505]/80 mix-blend-multiply"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/40 opacity-80"></div>
        </div>
    );
}
