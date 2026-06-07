"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { api, isBackendAuthError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Brain, Activity, User as UserIcon, LogOut, Home, PlusCircle, ShieldCheck,
  TrendingUp, TrendingDown, Minus, ClipboardList, ChevronRight, Mic, Camera,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const MODALITY_COLORS: Record<string, string> = {
  overall: "#4f46e5", speech: "#10b981", eeg: "#f59e0b", face: "#ef4444", clinical: "#8b5cf6",
};
const statusTone = (r?: number) =>
  r == null ? "text-slate-500 bg-slate-100" : r > 70 ? "text-red-600 bg-red-50" : r > 35 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const router = useRouter();
  const { locale } = useParams();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") { router.push(`/${locale}`); return; }
    if (status !== "authenticated" || fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      try {
        setAuthError("");
        const res = await api.get("/patients/");
        setAssessments(res.data);
      } catch (err) {
        if (isBackendAuthError(err)) setAuthError("Your session expired. Please sign in again.");
        else setAuthError("Could not load your data. Please try again shortly.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600" />
    </div>
  );

  // Build chronological trend data from each assessment's report summary.
  const withReports = assessments
    .map(a => ({ a, r: a.diagnosis_report }))
    .filter(x => x.r);
  const chronological = withReports.slice().reverse();
  const trend = chronological.map(({ a, r }) => {
    const m = r.summary?.modalities || {};
    return {
      date: new Date(a.created_at).toLocaleDateString(locale as string, { month: "short", day: "numeric" }),
      overall: r.risk_percentage ?? null,
      speech: m.speech ?? null, eeg: m.eeg ?? null, face: m.face ?? null, clinical: m.clinical ?? null,
    };
  });

  const latest = withReports[0]?.r;
  const baseline = withReports[withReports.length - 1]?.r;
  const latestRisk = latest?.risk_percentage;
  const delta = (latest && baseline && withReports.length > 1)
    ? Math.round((latest.risk_percentage ?? 0) - (baseline.risk_percentage ?? 0)) : 0;

  return (
    <div className="min-h-screen bg-slate-50/80 font-sans">
      {/* Sidebar */}
      <nav className="fixed top-0 left-0 bottom-0 w-20 lg:w-72 bg-white border-r border-slate-200 flex flex-col p-6 z-50">
        <div className="flex items-center gap-3 px-2 mb-12">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100"><Brain className="w-6 h-6 text-white" /></div>
          <span className="font-bold text-xl tracking-tight hidden lg:block text-slate-900">DementiaCare</span>
        </div>
        <div className="flex-1 space-y-3">
          <NavItem icon={<Home className="w-5 h-5" />} label="Home" href={`/${locale}`} />
          <NavItem icon={<Activity className="w-5 h-5" />} label="Dashboard" href={`/${locale}/profile`} active />
          <NavItem icon={<PlusCircle className="w-5 h-5" />} label="New assessment" href={`/${locale}/onboarding`} />
        </div>
        <div className="mt-auto border-t border-slate-100 pt-6">
          <button onClick={() => signOut()} className="flex items-center gap-3 w-full p-3.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all group">
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /><span className="font-semibold hidden lg:block">Sign out</span>
          </button>
        </div>
      </nav>

      <main className="pl-20 lg:pl-72 min-h-screen">
        <div className="max-w-7xl mx-auto p-6 lg:p-12">
          <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-2xl shadow-indigo-200">
                {session?.user?.name?.[0] || <UserIcon />}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome, {session?.user?.name?.split(" ")[0] || "User"}!</h1>
                <p className="text-slate-500 font-medium">Your remote cognitive-monitoring center.</p>
              </div>
            </div>
            <Link href={`/${locale}/onboarding`}>
              <Button className="rounded-2xl h-14 px-8 bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 text-base font-bold">
                <PlusCircle className="mr-2 w-5 h-5" /> New assessment
              </Button>
            </Link>
          </header>

          {authError && (
            <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-700 flex items-center justify-between gap-4">
              <p className="text-sm font-medium">{authError}</p>
              <Button onClick={() => router.push(`/${locale}`)} className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white">Sign in</Button>
            </div>
          )}

          {/* Decline-detection banner */}
          {withReports.length > 1 && (
            <div className={`mb-8 rounded-2xl p-5 flex items-center gap-4 border ${delta > 10 ? "bg-red-50 border-red-200" : delta < -10 ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
              {delta > 10 ? <TrendingUp className="w-8 h-8 text-red-500" /> : delta < -10 ? <TrendingDown className="w-8 h-8 text-emerald-500" /> : <Minus className="w-8 h-8 text-slate-400" />}
              <div>
                <p className="font-bold text-slate-900">
                  {delta > 10 ? "Increasing risk trend detected" : delta < -10 ? "Improving trend" : "Stable trajectory"}
                </p>
                <p className="text-sm text-slate-500">Overall risk changed by {delta > 0 ? "+" : ""}{delta} points since your first assessment.</p>
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <StatCard label="Latest risk" value={latestRisk != null ? `${Math.round(latestRisk)}%` : "—"} tone={statusTone(latestRisk)} icon={<ShieldCheck />} />
            <StatCard label="Status" value={latest?.predicted_status?.split(" ")[0] || (latest?.analysis_status === "processing" ? "Analyzing" : "—")} tone={statusTone(latestRisk)} icon={<Brain />} />
            <StatCard label="Confidence" value={latest?.confidence != null ? `${Math.round(latest.confidence)}%` : "—"} tone="text-indigo-600 bg-indigo-50" icon={<Activity />} />
            <StatCard label="Assessments" value={assessments.length} tone="text-slate-600 bg-slate-100" icon={<ClipboardList />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Trend chart */}
            <div className="lg:col-span-8 space-y-8">
              <Card className="border-none shadow-2xl shadow-slate-200/40 rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="p-8 pb-0">
                  <CardTitle className="text-2xl font-bold text-slate-900 mb-1">Risk trajectory</CardTitle>
                  <p className="text-slate-500 font-medium">Overall and per-modality cognitive-decline risk over time</p>
                </CardHeader>
                <CardContent className="p-8 pt-4 h-[420px]">
                  {trend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: 600 }} dy={10} />
                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                        <Tooltip contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 20px 40px -12px rgba(0,0,0,0.15)" }} />
                        <Legend />
                        <Line type="monotone" dataKey="overall" name="Overall" stroke={MODALITY_COLORS.overall} strokeWidth={4} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="speech" name="Speech" stroke={MODALITY_COLORS.speech} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="eeg" name="EEG" stroke={MODALITY_COLORS.eeg} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="face" name="Face" stroke={MODALITY_COLORS.face} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="clinical" name="Clinical" stroke={MODALITY_COLORS.clinical} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                      <div className="bg-slate-50 p-6 rounded-full"><Brain className="w-12 h-12 opacity-20" /></div>
                      <p className="font-medium">No assessments yet. Start your first one.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* History table */}
              <Card className="border-none shadow-2xl shadow-slate-200/40 rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="p-8 pb-2"><CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2"><ClipboardList className="text-indigo-600" /> Assessment history</CardTitle></CardHeader>
                <CardContent className="p-8 pt-2">
                  <div className="overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="text-left px-4 py-3 font-bold">Date</th>
                          <th className="text-left px-4 py-3 font-bold">Status</th>
                          <th className="text-right px-4 py-3 font-bold">Overall</th>
                          <th className="text-right px-4 py-3 font-bold">Speech</th>
                          <th className="text-right px-4 py-3 font-bold">EEG</th>
                          <th className="text-right px-4 py-3 font-bold">Face</th>
                          <th className="text-right px-4 py-3 font-bold">Clinical</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {withReports.map(({ a, r }) => {
                          const m = r.summary?.modalities || {};
                          return (
                            <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                              <td className="px-4 py-3 text-slate-700">{new Date(a.created_at).toLocaleDateString(locale as string, { year: "numeric", month: "short", day: "numeric" })}</td>
                              <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusTone(r.risk_percentage)}`}>{r.predicted_status?.split(" ")[0] || r.analysis_status}</span></td>
                              <td className="px-4 py-3 text-right font-black text-slate-900">{r.risk_percentage != null ? `${Math.round(r.risk_percentage)}%` : "—"}</td>
                              <td className="px-4 py-3 text-right text-slate-500">{m.speech != null ? Math.round(m.speech) : "—"}</td>
                              <td className="px-4 py-3 text-right text-slate-500">{m.eeg != null ? Math.round(m.eeg) : "—"}</td>
                              <td className="px-4 py-3 text-right text-slate-500">{m.face != null ? Math.round(m.face) : "—"}</td>
                              <td className="px-4 py-3 text-right text-slate-500">{m.clinical != null ? Math.round(m.clinical) : "—"}</td>
                              <td className="px-4 py-3 text-right">
                                <Link href={`/${locale}/diagnosis-result?id=${a.id}`} className="text-indigo-600 hover:text-indigo-800"><ChevronRight className="w-4 h-4 inline" /></Link>
                              </td>
                            </tr>
                          );
                        })}
                        {!withReports.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No completed assessments yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Side panel */}
            <div className="lg:col-span-4 space-y-8">
              <Card className="border-none shadow-2xl shadow-slate-200/40 rounded-[2.5rem] bg-indigo-600 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10"><Brain className="w-32 h-32" /></div>
                <CardContent className="p-8 relative z-10">
                  <h3 className="text-xl font-bold mb-5">Latest modalities</h3>
                  <div className="space-y-3">
                    {latest?.summary?.modalities && Object.entries(latest.summary.modalities).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between bg-white/10 rounded-2xl px-4 py-3 backdrop-blur-md">
                        <span className="capitalize font-semibold flex items-center gap-2">
                          {k === "speech" ? <Mic className="w-4 h-4" /> : k === "eeg" ? <Activity className="w-4 h-4" /> : k === "face" ? <Camera className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
                          {k}
                        </span>
                        <span className="font-black">{Math.round(v as number)}%</span>
                      </div>
                    ))}
                    {!latest?.summary?.modalities && <p className="text-indigo-100 text-sm">Run an assessment to see modality scores.</p>}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-2xl shadow-slate-200/40 rounded-[2.5rem] bg-white p-8">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><ShieldCheck className="text-indigo-600 w-5 h-5" /> About monitoring</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Repeat assessments periodically. A sustained upward trend in overall risk is more informative than any single result. This tool is a screening aid, not a diagnosis.</p>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, href, active = false }: any) {
  return (
    <Link href={href}>
      <div className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group ${active ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100" : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"}`}>
        <div className="transition-transform group-hover:scale-110">{icon}</div>
        <span className="font-bold hidden lg:block">{label}</span>
      </div>
    </Link>
  );
}

function StatCard({ label, value, icon, tone }: any) {
  return (
    <Card className="border-none shadow-xl shadow-slate-200/30 rounded-[2rem] overflow-hidden bg-white">
      <CardContent className="p-7">
        <div className={`w-12 h-12 ${tone} rounded-2xl flex items-center justify-center mb-5`}>{icon}</div>
        <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">{label}</h3>
        <div className="text-3xl font-black text-slate-900">{value}</div>
      </CardContent>
    </Card>
  );
}
