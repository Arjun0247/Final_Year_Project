"use client";
import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Label
} from "recharts";

import {
  Activity, TrendingUp, Droplet, ShieldCheck,
  Clock, Search, Download, LayoutDashboard, Fingerprint,
  ChevronRight, ArrowLeft
} from "lucide-react";

import Link from "next/link";
import { useSpotlight } from "../hooks/useSpotlight";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/* ✅ TYPES ADDED */
type Stats = {
  total: number;
  avg: number;
  mainGroup: string;
};

type Scan = {
  id: string;
  timestamp: string;
  result: string;
  confidence: number;
  status: string;
};

export default function DashboardPage() {
  const { token, isLoggedIn } = useAuth();

  /* ✅ FIXED TYPES */
  const [history, setHistory] = useState<Scan[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    avg: 0,
    mainGroup: "N/A"
  });

  // --- Load Data and Calculate Stats ---
  useEffect(() => {
    const calculateStats = (data: Scan[]) => {
      if (data.length === 0) {
        setStats({ total: 0, avg: 0, mainGroup: "N/A" });
        return;
      }

      /* ✅ FIXED avg (number not string) */
      const avg = parseFloat(
        (data.reduce((acc: number, curr: Scan) => acc + Number(curr.confidence || 0), 0) / data.length).toFixed(1)
      );

      /* ✅ FIXED reduce typing */
      const counts = data.reduce<Record<string, number>>((acc, curr: Scan) => {
        const key = curr.result || "Unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      /* ✅ SAFE main calculation */
      const main =
        Object.keys(counts).length > 0
          ? Object.keys(counts).reduce((a, b) =>
              counts[a] > counts[b] ? a : b
            )
          : "N/A";

      setStats({ total: data.length, avg, mainGroup: main });
    };

    const loadHistory = async () => {
      if (isLoggedIn && token) {
        try {
          const res = await axios.get(`${API}/user/scans`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          /* ✅ FIXED TYPES */
          const data: Scan[] = (res.data.scans || []).map((scan: unknown) => {
            const scanObj = scan as Record<string, unknown>;
            return {
              id: String(scanObj.id || scanObj._id || ""),
              timestamp: String(scanObj.timestamp || ""),
              result: String(scanObj.blood_group || "Unknown"),
              confidence: Number(scanObj.confidence ?? 0),
              status: 'Verified'
            };
          });

          setHistory(data);
          calculateStats(data);
          return;
        } catch (err) {
          console.warn('Failed API, using localStorage', err);
        }
      }

      const fallback: Scan[] = (() => {
        try {
          return JSON.parse(localStorage.getItem("userHistory") || "[]");
        } catch {
          return [];
        }
      })();
      setHistory(fallback);
      calculateStats(fallback);
    };

    loadHistory();
  }, [isLoggedIn, token]);

  useSpotlight();

  // --- Chart Data Formatting ---
  const trendData = history.length
    ? [...history].reverse().map((item, i) => ({
        name: `Scan ${i + 1}`,
        val: Number(item?.confidence || 0)
      }))
    : [];

  const groupDistribution = Object.entries(
    history.reduce<Record<string, number>>((acc, curr: Scan) => {
      const key = curr.result || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const COLORS = ['#22d3ee', '#3b82f6', '#ef4444', '#a855f7', '#f59e0b'];

return (
    <div className="min-h-screen bg-[#050505] text-white flex pt-24">


      {/* Background Visuals */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
      </div>
      <div
        className="fixed inset-0 z-0 opacity-30 pointer-events-none"
        style={{
          background: `radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(34, 211, 238, 0.15), transparent 40%)`
        }}
      />


      {/* --- Sidebar --- */}
      <aside className="w-64 border-r border-white/5 bg-black/40 backdrop-blur-2xl p-6 hidden lg:flex flex-col z-20">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            <Fingerprint className="text-black w-6 h-6" />
          </div>
          <span className="font-black tracking-tighter text-xl italic text-white">BIO-DASH</span>
        </div>

        <nav className="space-y-2 flex-1">
          <Link href="/predict" className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all group">
            <Activity className="w-5 h-5 group-hover:text-cyan-400" />
            <span className="text-sm font-bold">Live Scan</span>
          </Link>
          <div className="flex items-center gap-4 px-4 py-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl shadow-lg shadow-cyan-500/5">
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-sm font-bold">Analytics</span>
          </div>
        </nav>

        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Authenticated As</p>
          <p className="text-xs font-bold text-cyan-400">Genomic_User_77</p>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex-1 p-8 overflow-y-auto z-10 custom-scrollbar">

        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter mb-2 uppercase italic">Genomic Intelligence</h1>
            <p className="text-slate-500 font-light max-w-md">Aggregated biometric performance metrics and historical diagnostic records.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/predict" className="bg-white/5 border border-white/10 px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-white/10 transition-all">
              <ArrowLeft className="w-4 h-4" /> Back to Scanner
            </Link>
            <button className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-600/20">
              <Download className="w-4 h-4" /> Export Audit
            </button>
          </div>
        </header>

        {/* --- Bento Grid Stats --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: "Total Analysis", value: stats.total, icon: Activity, color: "text-cyan-400" },
            { label: "Avg Confidence", value: `${stats.avg}%`, icon: TrendingUp, color: "text-emerald-400" },
            { label: "Primary Phenotype", value: stats.mainGroup, icon: Droplet, color: "text-red-400" },
            { label: "System Uptime", value: "99.9%", icon: ShieldCheck, color: "text-purple-400" },
          ].map((s, i) => (
            <div key={i} className="bg-slate-900/40 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] hover:border-white/20 transition-all group">
              <div className="bg-white/5 p-3 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform">
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">{s.label}</p>
              <p className="text-3xl font-black mt-1 tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>

        {/* --- Charts Section --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">

          {/* Trend Area Chart */}
          <div className="lg:col-span-8 bg-slate-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[2.5rem] h-[400px]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Accuracy Progression Trend</h3>
              <div className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">System Optimizing</div>
            </div>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="80%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" hide />
                  <YAxis hide domain={[90, 100]} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '15px', backdropFilter: 'blur(10px)' }}
                    itemStyle={{ color: '#22d3ee', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="val" stroke="#22d3ee" strokeWidth={4} fill="url(#colorVal)" animationDuration={2000} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 text-sm italic">Insufficient data for trend analysis...</div>
            )}
          </div>

          {/* Distribution Pie Chart */}
          <div className="lg:col-span-4 bg-slate-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[2.5rem] flex flex-col items-center justify-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 w-full text-left">Phenotype Frequency</h3>
            {groupDistribution.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={groupDistribution} innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value">
                      {groupDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                      ))}
                      <Label value={stats.mainGroup} position="center" fill="#fff" style={{ fontSize: '24px', fontWeight: '900', fontStyle: 'italic' }} />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-6 w-full">
                  {groupDistribution.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-[10px] font-bold text-slate-500">{d.name}: {d.value} scans</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-slate-600 text-sm italic text-center">No scans recorded...</div>
            )}
          </div>
        </div>

        {/* --- Activity Logs Table --- */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Biometric Activity Logs</h3>
            <div className="relative w-full md:w-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                placeholder="Search scans..."
                className="bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs w-full md:w-64 focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black border-b border-white/5">
                <tr>
                  <th className="px-8 py-5">Uplink ID</th>
                  <th className="px-8 py-5">Timestamp</th>
                  <th className="px-8 py-5">Result</th>
                  <th className="px-8 py-5">Confidence</th>
                  <th className="px-8 py-5">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {history.length > 0 ? history.map((h, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-6 font-mono text-cyan-400 text-xs font-bold">{h.id}</td>
                    <td className="px-8 py-6 text-slate-400 text-xs flex items-center gap-2">
                      <Clock className="w-3 h-3 text-cyan-500/50" /> {new Date(h.timestamp).toLocaleString()}
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 font-black italic">{h.result}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]" style={{ width: `${h.confidence}%` }} />
                        </div>
                        <span className="font-bold text-xs">{h.confidence}%</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase rounded-full border border-emerald-500/20 tracking-tighter">
                        {h.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-slate-600 italic">No historical records found. Complete a scan to begin tracking.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-6 text-center border-t border-white/5">
            <button className="text-[10px] font-black text-slate-600 hover:text-cyan-400 transition-colors uppercase tracking-[0.3em]">Request Full Data Purge</button>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(34, 211, 238, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(34, 211, 238, 0.4); }
      `}</style>
    </div>
  );
}