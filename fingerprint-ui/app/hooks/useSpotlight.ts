"use client";

import { useEffect } from "react";

export function useSpotlight() {
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // Update CSS variables instead of React state to prevent re-renders
            document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
            document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);
}
