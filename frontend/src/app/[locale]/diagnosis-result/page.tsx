"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Brain, Activity, Mic, Camera, ClipboardList, ShieldCheck, ChevronRight,
  AlertTriangle, Loader2, CheckCircle2, FileText, Layers, Gauge, Info,
} from "lucide-react";
import {
  ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis,
  RadarChart, Radar, PolarGrid, PolarRadiusAxis,
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { api, pollReport, formatApiError, isBackendAuthError } from "@/lib/api";

const MODALITY_META: Record<string, { label: string; icon: any }> = {
  speech: { label: "Speech & Language", icon: Mic },
  eeg: { label: "EEG", icon: Activity },
  face: { label: "Facial", icon: Camera },
  clinical: { label: "Clinical", icon: ClipboardList },
};

const riskColor = (r: number) => (r > 70 ? "#ef4444" : r > 35 ? "#f59e0b" : "#10b981");
const riskTone = (r: number) =>
  r > 70 ? "text-red-600 bg-red-50" : r > 35 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50";

export default function DiagnosisResult() {
  const { locale } = useParams();
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const patientId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("id")
            : null;

        let pid = patientId;
        if (!pid) {
          const r = await api.post("/diagnose/", {});
          if (cancelled) return;
          setReport(r.data);
          pid = r.data?.patient;
        }
        if (pid) {
          await pollReport(pid, (rep) => {
            if (!cancelled) setReport(rep);
          });
        }
      } catch (error) {
        if (cancelled) return;
        setErrorMsg(formatApiError(error));
        if (isBackendAuthError(error)) setTimeout(() => router.replace(`/${locale}`), 1200);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locale, router]);

  const status = report?.analysis_status;
  const processing = !report || status === "pending" || status === "processing";

  if (errorMsg && !report) return <ErrorView msg={errorMsg} onRetry={() => window.location.reload()} locale={locale} router={router} />;
  if (processing) return <ProgressView report={report} />;
  if (status === "failed") return <ErrorView msg="Analysis could not be completed for any modality. Please retry the assessment." onRetry={() => router.push(`/${locale}/onboarding`)} locale={locale} router={router} />;

  return <ReportView report={report} locale={locale} router={router} />;
}

// ── Progress (while the worker analyzes each modality) ────────────────────────
function ProgressView({ report }: { report: any }) {
  const steps = [
    { key: "clinical_result", ...MODALITY_META.clinical },
    { key: "eeg_result", ...MODALITY_META.eeg },
    { key: "speech_result", ...MODALITY_META.speech },
    { key: "face_result", ...MODALITY_META.face },
  ];
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="relative w-28 h-28 mb-8">
        <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Brain className="w-14 h-14 text-indigo-600 animate-pulse" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Analyzing multimodal biomarkers…</h2>
      <p className="text-slate-500 mb-8 max-w-md text-center">
        Fusing speech, EEG, facial and clinical signals into a cognitive-decline risk estimate.
      </p>
      <div className="w-full max-w-md space-y-3">
        {steps.map((s) => {
          const r = report?.[s.key];
          const done = r && !r.error;
          const failed = r && r.error;
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex items-center gap-3 bg-slate-50 rounded-2xl px-5 py-3.5 border border-slate-100">
              <Icon className="w-5 h-5 text-slate-400" />
              <span className="flex-1 font-semibold text-slate-700">{s.label}</span>
              {done ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                : failed ? <AlertTriangle className="w-5 h-5 text-amber-500" />
                : <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ErrorView({ msg, onRetry, locale, router }: any) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
      <h2 className="text-2xl font-bold text-slate-900">Something went wrong</h2>
      <p className="text-slate-500 mt-2 max-w-md">{msg}</p>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={onRetry} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold">Retry</button>
        <button onClick={() => router.push(`/${locale}/profile`)} className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 border-2 border-slate-200 hover:bg-slate-50">Dashboard</button>
      </div>
    </div>
  );
}

// ── Full report dashboard ─────────────────────────────────────────────────────
function ReportView({ report, locale, router }: any) {
  const fusion = report.fusion_result || {};
  const overall = report.risk_percentage ?? fusion.overall_risk ?? 0;
  const statusLabel = report.predicted_status || fusion.predicted_status || "—";
  const confidence = report.confidence ?? fusion.confidence ?? 0;

  const radarData = (fusion.contributions || []).map((c: any) => ({ modality: c.label, risk: c.risk }));

  return (
    <div className="min-h-screen bg-slate-50/60 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-slate-900">Multimodal Cognitive Report</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => window.print()} className="text-sm font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1">
              <FileText className="w-4 h-4" /> Export
            </button>
            <button onClick={() => router.push(`/${locale}/profile`)} className="text-sm font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1">
              Dashboard <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-8 space-y-8">
        {report.analysis_status === "partial" && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
            <AlertTriangle className="w-5 h-5" />
            <p className="text-sm font-medium">Some modalities could not be analyzed; the result is based on the available signals.</p>
          </div>
        )}

        {/* Top: gauge + radar + contribution */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Gauge */}
          <Card>
            <div className="flex items-center gap-2 mb-4"><Gauge className="w-5 h-5 text-indigo-600" /><h3 className="font-bold text-slate-900">Overall Risk</h3></div>
            <div className="relative h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value: overall, fill: riskColor(overall) }]} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar background dataKey="value" cornerRadius={30} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black text-slate-900">{Math.round(overall)}%</span>
                <span className={`mt-2 px-3 py-1 rounded-full text-xs font-bold ${riskTone(overall)}`}>{statusLabel}</span>
              </div>
            </div>
            <p className="text-center text-sm text-slate-500 mt-2">Confidence: <span className="font-bold text-slate-700">{Math.round(confidence)}%</span></p>
          </Card>

          {/* Radar */}
          <Card>
            <div className="flex items-center gap-2 mb-4"><Layers className="w-5 h-5 text-indigo-600" /><h3 className="font-bold text-slate-900">Modality Risk Profile</h3></div>
            <div className="h-56">
              {radarData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="75%">
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="modality" tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="risk" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.35} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </Card>

          {/* Fusion contribution */}
          <Card>
            <div className="flex items-center gap-2 mb-4"><Activity className="w-5 h-5 text-indigo-600" /><h3 className="font-bold text-slate-900">Fusion Contribution</h3></div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fusion.contributions || []} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={90} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => [`${v}`, "Contribution"]} />
                  <Bar dataKey="contribution" radius={[0, 8, 8, 0]}>
                    {(fusion.contributions || []).map((c: any, i: number) => <Cell key={i} fill={riskColor(c.risk)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-400 mt-2">Each modality's weighted share of the fused risk.</p>
          </Card>
        </div>

        {/* Recommendation */}
        {report.recommendations && (
          <Card>
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Recommendation</h3>
                <p className="text-slate-600 leading-relaxed">{report.recommendations}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Per-modality panels */}
        {report.eeg_result && !report.eeg_result.error && <EegPanel data={report.eeg_result} />}
        {report.speech_result && !report.speech_result.error && <SpeechPanel data={report.speech_result} />}
        {report.face_result && !report.face_result.error && <FacePanel data={report.face_result} />}
        {report.clinical_result && !report.clinical_result.error && <ClinicalPanel data={report.clinical_result} />}

        <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5 pt-4">
          <Info className="w-3.5 h-3.5" /> This is a screening aid, not a medical diagnosis. Consult a clinician for evaluation.
        </p>
      </div>
    </div>
  );
}

// ── Modality panels ───────────────────────────────────────────────────────────
function EegPanel({ data }: { data: any }) {
  const bandData = Object.entries(data.band_powers || {}).map(([band, value]) => ({ band, value }));
  const probData = Object.entries(data.probabilities || {}).map(([k, v]) => ({ name: k, value: Math.round((v as number) * 100) }));
  const series = data.waveform_preview?.series || [];
  const channels = (data.waveform_preview?.channels || []).slice(0, 5);
  const colors = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  return (
    <PanelCard title="EEG Analysis" icon={Activity} risk={data.risk}
      subtitle={`${data.n_channels} channels · ${data.fs} Hz · ${data.duration_s}s · ${data.model_available ? "trained model" : "heuristic"}`}>
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-bold text-slate-600 mb-2">Signal (relative band power %)</h4>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bandData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="band" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <h4 className="text-sm font-bold text-slate-600 mt-4 mb-2">Class probabilities</h4>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={probData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis type="category" dataKey="name" width={60} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => [`${v}%`, "p"]} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {probData.map((d, i) => <Cell key={i} fill={d.name === "AD" ? "#ef4444" : d.name === "MCI" ? "#f59e0b" : "#10b981"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-600 mb-2">Uploaded waveform (µV)</h4>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="i" hide />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip />
                {channels.map((ch: string, i: number) => (
                  <Line key={ch} type="monotone" dataKey={ch} stroke={colors[i % colors.length]} dot={false} strokeWidth={1.5} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Ratio label="θ/α" value={data.ratios?.theta_alpha} />
            <Ratio label="θ/β" value={data.ratios?.theta_beta} />
            <Ratio label="slowing" value={data.ratios?.slowing} />
          </div>
        </div>
      </div>
      <BiomarkerTable rows={data.biomarkers} />
    </PanelCard>
  );
}

function SpeechPanel({ data }: { data: any }) {
  const a = data.acoustic || {}, l = data.linguistic || {};
  return (
    <PanelCard title="Speech & Language Analysis" icon={Mic} risk={data.risk}
      subtitle={`${a.duration_s || 0}s · ${l.word_count || 0} words`}>
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-bold text-slate-600 mb-2">Transcript</h4>
          <div className="bg-slate-50 rounded-2xl p-4 text-sm text-slate-700 leading-relaxed max-h-40 overflow-auto border border-slate-100">
            {data.transcript || <span className="text-slate-400 italic">No transcript (no/again unclear speech).</span>}
          </div>
        </div>
        <MetricGrid metrics={[
          ["Speech rate", `${l.words_per_min ?? "—"} wpm`],
          ["Pause ratio", `${Math.round((a.pause_ratio ?? 0) * 100)}%`],
          ["Lexical diversity", l.type_token_ratio ?? "—"],
          ["Filler ratio", `${Math.round((l.filler_ratio ?? 0) * 100)}%`],
          ["Mean sentence len", l.mean_sentence_len ?? "—"],
          ["Syntactic depth", l.syntactic_depth ?? "n/a"],
          ["F0 mean", a.f0_mean ? `${a.f0_mean} Hz` : "—"],
          ["Jitter", a.jitter ?? "—"],
        ]} />
      </div>
      <BiomarkerTable rows={data.biomarkers} />
    </PanelCard>
  );
}

function FacePanel({ data }: { data: any }) {
  const f = data.features || {};
  return (
    <PanelCard title="Facial Analysis" icon={Camera} risk={data.risk}
      subtitle={`${f.frames_analyzed || 0} frames · ${Math.round((f.detection_rate ?? 0) * 100)}% detected`}>
      <MetricGrid metrics={[
        ["Expressivity", f.expressivity ?? "—"],
        ["Blink rate", `${f.blink_rate_per_min ?? "—"}/min`],
        ["Head movement", f.head_movement ?? "—"],
        ["Mouth movement", f.mouth_movement ?? "—"],
        ["Brow movement", f.brow_movement ?? "—"],
        ["Analyzed", `${f.analyzed_seconds ?? "—"}s`],
      ]} />
      <BiomarkerTable rows={data.biomarkers} />
    </PanelCard>
  );
}

function ClinicalPanel({ data }: { data: any }) {
  return (
    <PanelCard title="Clinical / Questionnaire" icon={ClipboardList} risk={data.risk} subtitle={data.predicted_status}>
      {data.factors?.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left px-4 py-2 font-bold">Contributing factor</th><th className="text-right px-4 py-2 font-bold">Points</th></tr></thead>
            <tbody>
              {data.factors.map((f: any, i: number) => (
                <tr key={i} className="border-t border-slate-100"><td className="px-4 py-2 text-slate-700">{f.factor}</td><td className="px-4 py-2 text-right font-bold text-slate-900">+{f.points}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-slate-400">No notable risk factors reported.</p>}
    </PanelCard>
  );
}

// ── Small shared pieces ───────────────────────────────────────────────────────
function Card({ children }: any) {
  return <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40">{children}</div>;
}
function Empty() { return <div className="h-full flex items-center justify-center text-slate-300 text-sm">No data</div>; }
function Ratio({ label, value }: any) {
  return <div className="bg-slate-50 rounded-xl py-2 border border-slate-100"><div className="text-lg font-black text-slate-900">{value ?? "—"}</div><div className="text-[10px] font-bold text-slate-400 uppercase">{label}</div></div>;
}
function PanelCard({ title, icon: Icon, risk, subtitle, children }: any) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl"><Icon className="w-5 h-5 text-white" /></div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {typeof risk === "number" && <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${riskTone(risk)}`}>{Math.round(risk)}% risk</span>}
      </div>
      {children}
    </Card>
  );
}
function MetricGrid({ metrics }: { metrics: [string, any][] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {metrics.map(([k, v], i) => (
        <div key={i} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{k}</div>
          <div className="text-base font-bold text-slate-900">{v}</div>
        </div>
      ))}
    </div>
  );
}
function BiomarkerTable({ rows }: { rows: any[] }) {
  if (!rows?.length) return null;
  const tone = (s: string) => s === "normal" ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50";
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr><th className="text-left px-4 py-2 font-bold">Biomarker</th><th className="text-left px-4 py-2 font-bold">Value</th><th className="text-left px-4 py-2 font-bold">Normal</th><th className="text-left px-4 py-2 font-bold">Status</th></tr>
        </thead>
        <tbody>
          {rows.map((b, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-4 py-2 text-slate-700 font-medium" title={b.note || ""}>{b.name}</td>
              <td className="px-4 py-2 text-slate-900 font-bold">{String(b.value)}</td>
              <td className="px-4 py-2 text-slate-400">{b.normal_range}</td>
              <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tone(b.status)}`}>{b.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
