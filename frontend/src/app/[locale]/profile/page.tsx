"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { 
  Brain, 
  Calendar, 
  Activity, 
  User as UserIcon, 
  LogOut, 
  Home, 
  PlusCircle, 
  ShieldCheck, 
  Heart, 
  Cigarette, 
  Info,
  ChevronRight,
  ClipboardList
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const t = useTranslations("Profile");
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { locale } = useParams();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/${locale}`);
    }
    if (status === "authenticated") {
      fetchAssessments();
    }
  }, [status]);

  const fetchAssessments = async () => {
    try {
      const res = await api.get("/patients/");
      setAssessments(res.data);
    } catch (err) {
      console.error("Failed to fetch assessments", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
    </div>
  );

  const chartData = assessments.slice().reverse().map(a => ({
    date: new Date(a.created_at).toLocaleDateString(locale as string, { month: 'short', day: 'numeric' }),
    mmse: a.mmse_score,
    moca: a.moca_score
  }));

  const latest = assessments[0];

  return (
    <div className="min-h-screen bg-slate-50/80 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      {/* Sidebar - Always Light */}
      <nav className="fixed top-0 left-0 bottom-0 w-20 lg:w-72 bg-white border-r border-slate-200 flex flex-col p-6 z-50">
        <div className="flex items-center gap-3 px-2 mb-12">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight hidden lg:block text-slate-900">DementiaCare</span>
        </div>
        
        <div className="flex-1 space-y-3">
          <NavItem icon={<Home className="w-5 h-5" />} label="Bosh sahifa" href={`/${locale}`} />
          <NavItem icon={<Activity className="w-5 h-5" />} label="Dashboard" href={`/${locale}/profile`} active />
          <NavItem icon={<PlusCircle className="w-5 h-5" />} label="Yangi test" href={`/${locale}/onboarding`} />
        </div>

        <div className="mt-auto border-t border-slate-100 pt-6">
          <button 
            onClick={() => signOut()}
            className="flex items-center gap-3 w-full p-3.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all group"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold hidden lg:block">Chiqish</span>
          </button>
        </div>
      </nav>

      <main className="pl-20 lg:pl-72 min-h-screen">
        <div className="max-w-7xl mx-auto p-6 lg:p-12">
          {/* Header */}
          <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-2xl shadow-indigo-200">
                {session?.user?.name?.[0] || <UserIcon />}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                  Xush kelibsiz, {session?.user?.name?.split(' ')[0] || "User"}!
                </h1>
                <p className="text-slate-500 font-medium">Sizning kognitiv monitoringingiz markazi.</p>
              </div>
            </div>
            <Link href={`/${locale}/onboarding`}>
              <Button className="rounded-2xl h-14 px-8 bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 text-base font-bold transition-all hover:scale-105 active:scale-95">
                <PlusCircle className="mr-2 w-5 h-5" /> Yangi so'rovnoma
              </Button>
            </Link>
          </header>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <StatCard 
              label="Latest MMSE" 
              value={latest?.mmse_score || "—"} 
              color="indigo" 
              icon={<Brain />}
              tendency={assessments.length > 1 ? (latest?.mmse_score >= assessments[1]?.mmse_score ? "up" : "down") : null}
            />
            <StatCard 
              label="Latest MoCA" 
              value={latest?.moca_score || "—"} 
              color="emerald" 
              icon={<Activity />}
              tendency={assessments.length > 1 ? (latest?.moca_score >= assessments[1]?.moca_score ? "up" : "down") : null}
            />
            <StatCard 
              label="Tests Done" 
              value={assessments.length} 
              color="orange" 
              icon={<ClipboardList />}
            />
            <StatCard 
              label="Status" 
              value={latest ? (latest.mmse_score > 24 ? "Stable" : "Caution") : "No Data"} 
              color={latest?.mmse_score > 24 ? "emerald" : "rose"} 
              icon={<ShieldCheck />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Main Trend Chart */}
            <div className="lg:col-span-8 space-y-8">
              <Card className="border-none shadow-2xl shadow-slate-200/40 rounded-[2.5rem] overflow-hidden bg-white">
                <CardHeader className="p-10 pb-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold text-slate-900 mb-2">Salomatlik grafigi</CardTitle>
                      <p className="text-slate-500 font-medium">MMSE va MoCA natijalari o'zgarishi</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                        <span className="text-xs font-bold text-slate-500 uppercase">MMSE</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        <span className="text-xs font-bold text-slate-500 uppercase">MoCA</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-10 pt-4 h-[450px]">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorMMSE" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorMoCA" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} dy={15} />
                        <YAxis domain={[0, 30]} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} dx={-10} />
                        <Tooltip 
                          contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px'}} 
                          itemStyle={{fontWeight: 700}}
                        />
                        <Area type="monotone" dataKey="mmse" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorMMSE)" />
                        <Area type="monotone" dataKey="moca" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorMoCA)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                      <div className="bg-slate-50 p-6 rounded-full"><Brain className="w-12 h-12 opacity-20" /></div>
                      <p className="font-medium">Hozircha ma'lumotlar mavjud emas.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* History Breakdown */}
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-900 px-2 flex items-center gap-3">
                  <ClipboardList className="text-indigo-600" /> Assessment Tarixi
                </h2>
                {assessments.map((a, i) => (
                  <Card key={a.id} className="border-none shadow-xl shadow-slate-200/30 rounded-[2rem] overflow-hidden bg-white hover:shadow-2xl hover:-translate-y-1 transition-all duration-500">
                    <div className="p-8 flex flex-col md:flex-row md:items-center gap-8">
                      <div className="bg-indigo-50 p-5 rounded-[1.5rem] flex flex-col items-center justify-center min-w-[100px]">
                        <span className="text-indigo-600 font-black text-2xl">#{assessments.length - i}</span>
                        <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest mt-1">Test</span>
                      </div>
                      
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <div className="text-lg font-bold text-slate-900 mb-1">
                              {new Date(a.created_at).toLocaleDateString(locale as string, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              {a.hypertension && <MarkerBadge icon={<Heart className="w-3 h-3" />} label="Hypertension" />}
                              {a.diabetes && <MarkerBadge icon={<Activity className="w-3 h-3" />} label="Diabetes" />}
                              {a.history_of_stroke && <MarkerBadge icon={<ShieldCheck className="w-3 h-3" />} label="Stroke" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <ScoreCircle value={a.mmse_score} label="MMSE" color="indigo" />
                            <ScoreCircle value={a.moca_score} label="MoCA" color="emerald" />
                          </div>
                        </div>
                      </div>
                      
                      <Link href={`/${locale}/onboarding`} className="group">
                         <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all text-slate-400">
                           <ChevronRight />
                         </div>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Sidebar / Medical Record */}
            <div className="lg:col-span-4 space-y-8">
              <Card className="border-none shadow-2xl shadow-slate-200/40 rounded-[2.5rem] bg-indigo-600 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                   <Brain className="w-32 h-32" />
                </div>
                <CardContent className="p-10 relative z-10">
                  <h3 className="text-xl font-bold mb-6">Tibbiy ko'rsatmalar</h3>
                  <div className="space-y-6">
                    <p className="text-indigo-100 leading-relaxed font-medium">
                      Sizning kognitiv salomatligingiz <strong>{latest?.mmse_score > 24 ? "barqaror" : "monitoring talab etiladi"}</strong> holatda.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md">
                        <div className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Yoshi</div>
                        <div className="text-xl font-bold">{latest?.age || "—"}</div>
                      </div>
                      <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md">
                        <div className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Uyqu</div>
                        <div className="text-xl font-bold">{latest?.sleep_hours_per_day || "—"} soat</div>
                      </div>
                    </div>
                    <Button className="w-full h-14 rounded-2xl font-bold border border-white/20 bg-white/10 hover:bg-white/20 text-white shadow-lg">
                      Mutaxassis bilan bog'lanish
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-2xl shadow-slate-200/40 rounded-[2.5rem] bg-white p-8">
                <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Info className="text-indigo-600 w-5 h-5" /> Ma'lumot
                </h3>
                <div className="space-y-4">
                  <p className="text-sm text-slate-500 leading-relaxed">
                    MMSE va MoCA testlari natijalari monitoring qilinishi muhim. 24 balldan past natija kognitiv o'zgarishlar alomati bo'lishi mumkin.
                  </p>
                  <div className="h-px bg-slate-100"></div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 font-medium">Oxirgi yangilanish</span>
                    <span className="text-slate-900 font-bold">{latest ? new Date(latest.created_at).toLocaleDateString() : "Never"}</span>
                  </div>
                </div>
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
      <div className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group ${
        active 
          ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100" 
          : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
      }`}>
        <div className="transition-transform group-hover:scale-110">
          {icon}
        </div>
        <span className="font-bold hidden lg:block">{label}</span>
      </div>
    </Link>
  );
}

function StatCard({ label, value, sub, icon, color, tendency }: any) {
  const colors: any = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    rose: "bg-rose-50 text-rose-600"
  };

  return (
    <Card className="border-none shadow-xl shadow-slate-200/30 rounded-[2rem] overflow-hidden bg-white">
      <CardContent className="p-8">
        <div className={`w-14 h-14 ${colors[color]} rounded-2xl flex items-center justify-center mb-6 shadow-sm`}>
          {icon}
        </div>
        <div>
          <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">{label}</h3>
          <div className="flex items-end gap-3">
            <div className="text-3xl font-black text-slate-900">{value}</div>
            {tendency && (
              <div className={`mb-1 text-xs font-bold ${tendency === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {tendency === 'up' ? '↑ Success' : '↓ Caution'}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MarkerBadge({ icon, label }: any) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function ScoreCircle({ value, label, color }: any) {
  const colors: any = {
    indigo: "text-indigo-600 bg-indigo-50",
    emerald: "text-emerald-600 bg-emerald-50"
  };
  return (
    <div className="flex flex-col items-center">
      <div className={`w-14 h-14 ${colors[color]} rounded-full flex items-center justify-center text-lg font-black shadow-inner`}>
        {value || "—"}
      </div>
      <span className="text-[10px] font-black text-slate-400 mt-2 tracking-widest uppercase">{label}</span>
    </div>
  );
}
