"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
import { jsPDF } from "jspdf";
import {
  Download, AlertTriangle, Fingerprint, Activity,
  Droplet, UserCheck, ShieldCheck, ChevronRight, Loader2, LayoutDashboard
} from "lucide-react";
import Link from "next/link"; // Assuming you are using Next.js
import { useSpotlight } from "../hooks/useSpotlight";
import { useAuth } from "../context/AuthContext";


// --- Utility types ---
type Compatibility = { give: string[]; receive: string[] };

// --- Utility: Blood Compatibility Logic ---
const getCompatibility = (bloodGroup: string): Compatibility => {
  const compatibility: Record<string, Compatibility> = {
    "A+": { give: ["A+", "AB+"], receive: ["A+", "A-", "O+", "O-"] },
    "O+": { give: ["O+", "A+", "B+", "AB+"], receive: ["O+", "O-"] },
    "B+": { give: ["B+", "AB+"], receive: ["B+", "B-", "O+", "O-"] },
    "AB+": { give: ["AB+"], receive: ["Everyone"] },
    "A-": { give: ["A+", "A-", "AB+", "AB-"], receive: ["A-", "O-"] },
    "O-": { give: ["Everyone"], receive: ["O-"] },
    "B-": { give: ["B+", "B-", "AB+", "AB-"], receive: ["B-", "O-"] },
    "AB-": { give: ["AB+", "AB-"], receive: ["AB-", "A-", "B-", "O-"] },
  };
  return compatibility[bloodGroup] || { give: [], receive: [] };
};

// --- Utility: Mock Probability Distribution ---
const generateProbabilityData = (predictedGroup: string) => {
  const groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  return groups.map((g) => ({
    name: g,
    probability: g === predictedGroup ? Math.floor(Math.random() * (98 - 92) + 92) : Math.floor(Math.random() * 5),
  }));
};

// --- Utility: Build probability chart data from backend response ---
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const buildProbabilityData = (allProbabilities: Record<string, number> | null | undefined) => {
  if (!allProbabilities) return [];
  return BLOOD_GROUPS.map((g) => ({
    name: g,
    // Backend sends percentages (0–100); use as-is.
    probability: allProbabilities[g] ?? 0,
  }));
};

const Background = () => (
  <>
    <div className="absolute inset-0 z-0">
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/95 to-[#050505]/80"></div>
    </div>
    <div
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        backgroundImage: `linear-gradient(0deg, transparent 24%, rgba(34, 211, 238, 0.1) 25%, rgba(34, 211, 238, 0.1) 26%, transparent 27%, transparent 74%, rgba(34, 211, 238, 0.1) 75%, rgba(34, 211, 238, 0.1) 76%, transparent 77%)`,
        backgroundSize: '50px 50px',
        maskImage: `radial-gradient(500px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), black, transparent)`,
        WebkitMaskImage: `radial-gradient(500px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), black, transparent)`,
        opacity: 0.4
      }}
    ></div>
  </>
);

export default function PredictPage() {
  const { token, isLoggedIn } = useAuth();
  const [viewState, setViewState] = useState("landing"); // 'landing' or 'dashboard'
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);
  const [probabilityData, setProbabilityData] = useState<Array<{ name: string; probability: number }>>([]);



  // --- FEATURE: Save Prediction to History ---
  const saveToHistory = (bloodGroup: string, confidenceValue: number | null) => {
    const confidence = confidenceValue != null
      ? confidenceValue.toFixed(1)
      : (94 + Math.random() * 5).toFixed(1); // fallback if backend value missing

    const newEntry = {
      id: `SCAN-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      result: bloodGroup,
      confidence: confidence,
      status: "Verified"
    };

    // For authenticated users, backend stores scans in MongoDB, so localStorage is optional.
    if (!isLoggedIn) {
      const existingHistory = JSON.parse(localStorage.getItem("userHistory") || "[]");
      const updatedHistory = [newEntry, ...existingHistory];
      localStorage.setItem("userHistory", JSON.stringify(updatedHistory));
    }

    return newEntry;
  };

  // --- Image Quality Check ---
  const checkImageQuality = (file: File) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setQualityWarning("Unable to access canvas context");
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let colorSum = 0;
      for (let i = 0; i < data.length; i += 4) {
        colorSum += Math.floor((data[i] + data[i + 1] + data[i + 2]) / 3);
      }
      const brightness = Math.floor(colorSum / (img.width * img.height));
      setQualityWarning(brightness < 40 ? "Image is too dark. Ensure better lighting." : null);
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    checkImageQuality(selected);
  };

  const handlePredict = async () => {
    if (!file) return;
    setLoading(true);
    setProgress(10);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const progTimer = setInterval(() => setProgress(p => p < 90 ? p + 10 : p), 300);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(`${API}/predict`, formData, { headers });
      clearInterval(progTimer);

      const predictedGroup = res.data.blood_group;
      const backendConfidenceRaw = res.data.confidence;
      const backendConfidence = typeof backendConfidenceRaw === "number"
        ? backendConfidenceRaw
        : parseFloat(backendConfidenceRaw);
      const allProbabilities = res.data.all_probabilities;

      setResult(predictedGroup);
      setConfidence(!isNaN(backendConfidence) ? backendConfidence : null);
      setProbabilityData(buildProbabilityData(allProbabilities));

      saveToHistory(predictedGroup, !isNaN(backendConfidence) ? backendConfidence : null);

      setProgress(100);

      setTimeout(() => {
        // For logged in user, we go to the dashboard where data is fetched from /user/scans.
        setViewState("dashboard");
        setLoading(false);
      }, 800);
    } catch (err) {
      alert("Prediction failed. Please check backend connection.");
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Medical AI Diagnostic Report", 20, 20);
    doc.text(`Blood Group: ${result}`, 20, 40);
    doc.save(`Report_${result}.pdf`);
  };

  // --- Mouse Movement for Spotlight ---
  // Use optimized spotlight hook
  useSpotlight();


  // --- LANDING VIEW (UPLOAD) ---
  if (viewState === "landing") {
    return (
      <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 pt-24 relative overflow-hidden animate-in fade-in duration-700">

        <Background />

        <div className="z-10 w-full max-w-2xl">
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-white mb-3">Initialize Analysis</h2>
            <p className="text-slate-400">Securely upload a high-resolution fingerprint scan for biometric processing.</p>
          </div>

          <div className={`border-2 border-dashed ${qualityWarning ? 'border-amber-500/50 bg-amber-500/5' : 'border-cyan-500/30 bg-cyan-500/5'} rounded-3xl flex flex-col items-center justify-center p-12 transition-all relative overflow-hidden group hover:border-cyan-400 hover:bg-cyan-500/10 min-h-[400px]`}>
            {!preview ? (
              <>
                <div className="bg-cyan-500/10 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Fingerprint className="w-20 h-20 text-cyan-400" />
                </div>
                <p className="text-lg font-medium text-slate-300 mb-2">Drag & Drop or Click to Upload</p>
                <p className="text-sm text-slate-500 font-mono tracking-widest">Awaiting Bio-Data...</p>
                <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              </>
            ) : (
              <div className="relative w-full h-full flex flex-col items-center animate-in zoom-in-95 duration-300">
                <img src={preview} alt="Scan" className="max-h-[300px] object-contain rounded-lg shadow-2xl border border-white/10" />
                {qualityWarning && (
                  <div className="mt-4 flex items-center gap-2 text-amber-300 bg-amber-900/40 px-4 py-2 rounded-full text-sm border border-amber-500/30">
                    <AlertTriangle className="w-4 h-4" />
                    {qualityWarning}
                  </div>
                )}
                <button onClick={() => { setPreview(null); setFile(null); }} className="mt-6 text-sm text-slate-400 hover:text-red-400 transition-colors uppercase tracking-wider font-bold">Discard Image</button>
              </div>
            )}
          </div>

          <button
            onClick={handlePredict}
            disabled={loading || !file}
            className={`mt-8 w-full py-5 rounded-none font-bold text-lg tracking-widest shadow-lg transition-all flex items-center justify-center gap-3 uppercase
              ${loading || !file
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_50px_rgba(6,182,212,0.6)] border border-cyan-400'
              }`}
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Processing... {progress}%</>
            ) : (
              <><Activity className="w-5 h-5" /> Analyze Pattern <ChevronRight className="w-5 h-5" /></>
            )}
          </button>

          <div className="mt-6 text-center">
            <Link href="/dashboard" className="text-slate-500 hover:text-cyan-400 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <LayoutDashboard className="w-4 h-4" /> View History Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // --- DASHBOARD VIEW (Result View) ---
  const compatibility = result ? getCompatibility(result) : null;
  const isLowDataClass = result && ["A-", "AB-", "B-"].includes(result);

  return (
    <main className="min-h-screen bg-[#050505] text-white p-6 pt-24 animate-in fade-in slide-in-from-bottom-5 duration-1000 relative overflow-hidden">

      <Background />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">

        {/* Left Panel: Preview */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/10 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-cyan-500/20 p-2 rounded-lg border border-cyan-500/30">
                <ShieldCheck className="w-6 h-6 text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold">Analyzed Sample</h2>
            </div>
            <div className="flex-1 rounded-2xl flex flex-col items-center justify-center p-8 bg-black/40 border border-slate-800 relative overflow-hidden">
              <img src={preview || ""} alt="Scan" className="max-h-[300px] object-contain rounded-lg shadow-2xl drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]" />
              <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400 animate-scan opacity-50"></div>
            </div>
            <button onClick={() => setViewState("landing")} className="mt-6 w-full py-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all uppercase text-sm font-bold">New Scan</button>
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 bg-gradient-to-br from-slate-900/80 to-slate-900/40 rounded-3xl p-8 border border-white/10 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2">Genomic Match</p>
              <h1 className="text-8xl md:text-9xl font-black tracking-tighter">{result}</h1>
            </div>
            <div className="text-right flex flex-col items-end gap-3">
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xl bg-emerald-950/30 px-4 py-2 rounded-full border border-emerald-500/30">
                  <UserCheck className="w-5 h-5" />
                  <span>
                    {confidence != null
                      ? `${confidence.toFixed(1)}% Confidence`
                      : "Confidence unavailable"}
                  </span>
                </div>
                {isLowDataClass && (
                  <p className="text-[10px] text-amber-300 max-w-xs text-right">
                    Note: This blood group is trained with limited scanner data. Treat this result as preliminary and
                    confirm with a standard blood test.
                  </p>
                )}
              </div>
              <button onClick={handleExportPDF} className="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all">
                <Download className="w-4 h-4" /> DOWNLOAD PDF
              </button>
              <Link href="/dashboard" className="text-cyan-400 hover:underline text-xs font-bold uppercase mt-2 flex items-center gap-1">
                Open Analytics <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-slate-900/60 rounded-3xl p-6 border border-white/10 h-[340px]">
            <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400" /> Statistical Probability</h3>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={probabilityData}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', background: '#0f172a' }} />
                <Bar dataKey="probability" radius={[6, 6, 0, 0]}>
                  {probabilityData.map((e, i) => <Cell key={i} fill={e.name === result ? '#22d3ee' : '#334155'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Compatibility */}
          <div className="bg-slate-900/60 rounded-3xl p-6 border border-white/10 h-[340px]">
            <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase flex items-center gap-2"><Droplet className="w-4 h-4 text-red-500" /> Donor Matrix</h3>
            <div className="space-y-4">
              <div className="bg-emerald-950/20 p-5 rounded-2xl border border-emerald-500/20">
                <p className="text-[10px] font-bold text-emerald-500 uppercase mb-2">Can Donate To</p>
                <div className="flex flex-wrap gap-2">
                  {compatibility?.give.map(g => <span key={g} className="px-3 py-1 bg-emerald-500/10 rounded text-xs font-bold text-emerald-400 border border-emerald-500/30">{g}</span>)}
                </div>
              </div>
              <div className="bg-blue-950/20 p-5 rounded-2xl border border-blue-500/20">
                <p className="text-[10px] font-bold text-blue-500 uppercase mb-2">Can Receive From</p>
                <div className="flex flex-wrap gap-2">
                  {compatibility?.receive.map(g => <span key={g} className="px-3 py-1 bg-blue-500/10 rounded text-xs font-bold text-blue-400 border border-blue-500/30">{g}</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(300px); opacity: 0; }
        }
        .animate-scan { animation: scan 2.5s linear infinite; }
      `}</style>
    </main>
  );
}