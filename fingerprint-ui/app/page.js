"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, ChevronRight } from "lucide-react";
import { useSpotlight } from "./hooks/useSpotlight";

export default function LandingPage() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Use optimized spotlight hook
  useSpotlight();

  const handleStartScan = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      router.push("/predict");
    }, 800);
  };

  return (
    <main className={`min-h-screen text-white flex flex-col items-center justify-center p-6 pt-24 relative overflow-hidden transition-all duration-1000 ease-in-out ${isTransitioning ? 'opacity-0 scale-110 filter blur-lg' : 'opacity-100 scale-100'}`}>


      {/* Background Video handled globally in layout.tsx */}

      {/* Dynamic Spotlight Effect - Uses CSS variables set by useSpotlight hook */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        style={{
          backgroundImage: `linear-gradient(0deg, transparent 24%, rgba(34, 211, 238, 0.1) 25%, rgba(34, 211, 238, 0.1) 26%, transparent 27%, transparent 74%, rgba(34, 211, 238, 0.1) 75%, rgba(34, 211, 238, 0.1) 76%, transparent 77%)`,
          backgroundSize: '50px 50px',
          maskImage: `radial-gradient(500px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), black, transparent)`,
          WebkitMaskImage: `radial-gradient(500px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), black, transparent)`,
          opacity: 0.6
        }}
      ></div>

      <div className="z-10 text-center max-w-4xl px-6 relative">
        <div className="flex justify-center mb-8">
          <div className="relative group">
            <div className="absolute inset-0 bg-cyan-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
            <div className="bg-slate-900/50 p-6 rounded-full border border-cyan-500/30 backdrop-blur-md relative">
              <Fingerprint className="w-20 h-20 text-cyan-400" />
            </div>
          </div>
        </div>

        <h1 className="text-7xl md:text-8xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500 mb-8 tracking-tighter drop-shadow-2xl">
          <span className="text-cyan-400">RAPID</span> <br />
          BIO-DIAGNOSIS
        </h1>

        <p className="text-xl md:text-2xl text-slate-400 mb-12 leading-relaxed font-light max-w-2xl mx-auto">
          Next-generation biometric analysis for instant identification.
          <br />
          <span className="text-cyan-400 font-mono text-lg mt-2 inline-block tracking-widest">
            PRECISION // SPEED // SECURITY
          </span>
        </p>

        <button
          onClick={handleStartScan}
          className="group relative inline-flex items-center gap-4 px-10 py-5 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-400 font-bold text-lg rounded-none border border-cyan-500/50 hover:border-cyan-400 transition-all uppercase tracking-widest overflow-hidden"
        >
          <span className="relative z-10 flex items-center gap-3">
            Initialize Scan
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
          <div className="absolute inset-0 bg-cyan-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
        </button>
      </div>
    </main>
  );
}
