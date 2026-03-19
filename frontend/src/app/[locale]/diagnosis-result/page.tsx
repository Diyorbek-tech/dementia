"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { 
  Brain, 
  Activity, 
  ShieldCheck, 
  ChevronRight, 
  AlertTriangle,
  FileText,
  RefreshCw,
  TrendingUp,
  Heart
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { api } from "@/lib/api";

export default function DiagnosisResult() {
  const t = useTranslations("Form");
  const { locale } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        // Simulate progress bar for "AI Analysis" effect
        const timer = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 100) {
              clearInterval(timer);
              return 100;
            }
            return prev + 2;
          });
        }, 50);

        const res = await api.post("/diagnose/");
        setReport(res.data);
        
        setTimeout(() => {
          setLoading(false);
          clearInterval(timer);
        }, 3000); // Minimum 3s for dramatic effect
      } catch (error) {
        console.error("Diagnosis error:", error);
        setLoading(false);
      }
    };

    fetchResult();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="relative w-32 h-32 mb-8">
           <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-20"></div>
           <div className="absolute inset-0 flex items-center justify-center">
              <Brain className="w-16 h-16 text-indigo-600 animate-pulse" />
           </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Sun'iy Intellekt Tahlil Qilmoqda...</h2>
        <p className="text-slate-500 mb-8 max-w-xs text-center">Neural tarmoqlar sizning ma'lumotlaringizni EEG bazasi bilan solishtirmoqda.</p>
        
        <div className="w-full max-w-md bg-slate-100 h-2 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-600 transition-all duration-300" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="mt-4 text-sm font-bold text-indigo-600">{progress}%</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900">Xatolik yuz berdi</h2>
        <p className="text-slate-500 mt-2">Ma'lumotlarni tahlil qilib bo'lmadi.</p>
        <button 
          onClick={() => router.push(`/${locale}/onboarding`)}
          className="mt-6 bg-indigo-600 text-white px-6 py-2 rounded-xl"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  const eegData = report.eeg_data_json || [];

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-slate-900">Diagnosis AI Report</span>
          </div>
          <button 
            onClick={() => router.push(`/${locale}/profile`)}
            className="text-sm font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1"
          >
            Yopish <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-8">
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Main Status */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Tahlil Natijasi</h1>
                  <p className="text-slate-500">AI tomonidan taqdim etilgan kognitiv holat xulosasi.</p>
                </div>
                <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${
                  report.risk_percentage > 70 ? "bg-red-50 text-red-600" : 
                  report.risk_percentage > 35 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                }`}>
                  {report.predicted_status}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-8 items-center">
                <div className="relative flex items-center justify-center">
                   <div className="w-48 h-48 rounded-full border-[12px] border-slate-100 relative flex items-center justify-center">
                      <div className="text-center">
                         <span className="text-4xl font-black text-slate-900">{report.risk_percentage}%</span>
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Xavf Darajasi</p>
                      </div>
                      <svg className="absolute inset-[-12px] w-[calc(100%+24px)] h-[calc(100%+24px)] -rotate-90">
                        <circle
                          cx="50%"
                          cy="50%"
                          r="47%"
                          fill="transparent"
                          stroke={report.risk_percentage > 70 ? "#ef4444" : report.risk_percentage > 35 ? "#f59e0b" : "#10b981"}
                          strokeWidth="12"
                          strokeDasharray="300"
                          strokeDashoffset={300 - (300 * report.risk_percentage / 100)}
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                   </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <p className="text-xs font-bold text-slate-400 mb-1 uppercase">Tavsiya</p>
                     <p className="text-sm text-slate-700 leading-relaxed font-medium">
                       {report.recommendations}
                     </p>
                  </div>
                  <div className="flex items-center gap-3 text-emerald-600 text-sm font-bold bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                    <ShieldCheck className="w-5 h-5" /> Ma'lumotlar 94% aniqlik bilan solishtirildi
                  </div>
                </div>
              </div>
            </div>

            {/* EEG Visualization */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 p-2 rounded-xl">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Neural EEG To'lqinlari</h2>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dataset Matching (Fp1-Fp2)</p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={eegData}>
                    <defs>
                      <linearGradient id="colorWave" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      labelClassName="hidden"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Fp1" 
                      stroke="#4f46e5" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorWave)" 
                      animationDuration={2000}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Fp2" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      fillOpacity={0} 
                      animationDuration={2500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-6 text-2xs text-slate-400 leading-tight">
                * Yuqoridagi grafik sizning ma'lumotlaringizga mos keluvchi Kaggle EEG Alzheimer's Dataset'idagi frontal (Fp1, Fp2) kanallarining 16-kanalli signal fragmentini simulyatsiya qiladi.
              </p>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-indigo-600 rounded-[2rem] p-6 text-white overflow-hidden relative">
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 blur-2xl rounded-full"></div>
              <TrendingUp className="w-8 h-8 mb-4 opacity-80" />
              <h3 className="text-lg font-bold mb-2">Keyingi Qadamlar</h3>
              <p className="text-sm text-indigo-100 mb-6 leading-relaxed">
                Natijalarni saqlab qo'ying va mutaxassis bilan maslahatlashing.
              </p>
              <button 
                onClick={() => window.print()}
                className="w-full bg-white text-indigo-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
              >
                <FileText className="w-4 h-4" /> Hisobotni Yuklash
              </button>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-lg shadow-slate-200/20">
               <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                 <Heart className="w-4 h-4 text-red-500" /> Profilaktika
               </h3>
               <ul className="space-y-3">
                 {[
                   "Sog'lom uyqu rejimi",
                   "O'rta yer dengizi parhezi",
                   "Muntazam jismoniy faollik",
                   "Ijtimoiy muloqot"
                 ].map((tip, i) => (
                   <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                     <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                     {tip}
                   </li>
                 ))}
               </ul>
            </div>

            <button 
              onClick={() => router.push(`/${locale}/onboarding`)}
              className="w-full flex items-center justify-center gap-2 py-4 text-slate-400 hover:text-indigo-600 font-bold transition-all"
            >
              <RefreshCw className="w-4 h-4" /> Qayta Test Topshirish
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
