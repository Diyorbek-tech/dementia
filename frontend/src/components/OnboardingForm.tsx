"use client"

import { useState, useRef, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  CheckCircle2, ChevronRight, ChevronLeft, AlertCircle,
  Brain, Heart, User, Activity, Mic, Camera,
  Upload, RefreshCw, FileImage, Loader2,
  Square, Stethoscope, Download,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { api, isBackendAuthError, formatApiError } from "@/lib/api"

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost/api").replace(/\/+$/, "")

// English reading passage used for the speech-biomarker task.
const SPEECH_PASSAGE =
  "Yesterday was a bright and pleasant day. The sun was shining and the sky was clear and blue. " +
  "I sat in my garden and remembered my old friends. When we were young, we would walk to the river " +
  "together and catch fish. Life is a precious gift, and we should welcome each new day with gratitude."

// ── Schema (non-file fields) ───────────────────────────────────────────────────
const formSchema = z.object({
  age: z.number().int("Age must be a whole number").min(18, "Age must be over 18").max(120, "Age must be under 120"),
  gender: z.enum(["M", "F", "O"]),
  education_level: z.enum(["None", "Primary", "Secondary", "Higher"]),
  hypertension: z.boolean(),
  diabetes: z.boolean(),
  history_of_stroke: z.boolean(),
  depression: z.boolean(),
  family_history_of_alzheimers: z.boolean(),
  alcohol_use: z.boolean(),
  memory_complaints: z.boolean(),
  language_difficulties: z.boolean(),
  orientation_problems: z.boolean(),
  mood_behavioral_changes: z.boolean(),
  smoking_status: z.enum(["Never", "Former", "Current"]),
  sleep_hours_per_day: z.number().int("Sleep hours must be a whole number").min(0).max(24),
  physical_activity: z.enum(["None", "Low", "Moderate", "High"]),
  mmse_score: z.number().min(0).max(30).nullable().optional(),
  moca_score: z.number().min(0).max(30).nullable().optional(),
})

type FormValues = z.infer<typeof formSchema>

const TOTAL_STEPS = 7
const STEPS = [
  { id: 1, title: "Personal Information", icon: User },
  { id: 2, title: "Medical History", icon: Heart },
  { id: 3, title: "Cognitive Symptoms", icon: Brain },
  { id: 4, title: "Lifestyle", icon: Activity },
  { id: 5, title: "EEG & Clinical Scores", icon: FileImage },
  { id: 6, title: "Speech Task", icon: Mic },
  { id: 7, title: "Facial Task", icon: Camera },
]

const STEP_FIELDS: Record<number, (keyof FormValues)[]> = {
  1: ["age", "gender", "education_level"],
  2: ["hypertension", "diabetes", "history_of_stroke", "depression", "family_history_of_alzheimers", "alcohol_use"],
  3: ["memory_complaints", "language_difficulties", "orientation_problems", "mood_behavioral_changes"],
  4: ["smoking_status", "sleep_hours_per_day", "physical_activity"],
  5: [], 6: [], 7: [],
}

const inputCls = (hasError: boolean) =>
  cn("w-full h-12 px-4 rounded-xl border-2 text-slate-800 text-base bg-white",
    "focus:outline-none focus:ring-2 transition-colors",
    hasError ? "border-red-400 focus:ring-red-200 focus:border-red-400"
      : "border-slate-200 focus:border-blue-500 focus:ring-blue-100")
const selectCls = (hasError: boolean) => cn(inputCls(hasError), "appearance-none cursor-pointer")

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0")
  const s = (seconds % 60).toString().padStart(2, "0")
  return `${m}:${s}`
}

export default function OnboardingForm() {
  const { status, update } = useSession()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale

  const [step, setStep] = useState(1)
  const [apiError, setApiError] = useState("")

  // Voice recording
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null)
  const [voiceTimer, setVoiceTimer] = useState(0)
  const voiceRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceChunksRef = useRef<Blob[]>([])
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const voiceAudioURL = voiceBlob ? URL.createObjectURL(voiceBlob) : null

  // Face recording
  const [isFaceRecording, setIsFaceRecording] = useState(false)
  const [faceBlob, setFaceBlob] = useState<Blob | null>(null)
  const [faceTimer, setFaceTimer] = useState(0)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const faceRecorderRef = useRef<MediaRecorder | null>(null)
  const faceChunksRef = useRef<Blob[]>([])
  const faceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const faceStreamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const faceVideoURL = faceBlob ? URL.createObjectURL(faceBlob) : null

  // File uploads
  const [eegFile, setEegFile] = useState<File | null>(null)
  const [mriFile, setMriFile] = useState<File | null>(null)
  const [eegPreview, setEegPreview] = useState<string | null>(null)
  const [mriPreview, setMriPreview] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting }, trigger } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hypertension: false, diabetes: false, history_of_stroke: false, depression: false,
      family_history_of_alzheimers: false, alcohol_use: false, memory_complaints: false,
      language_difficulties: false, orientation_problems: false, mood_behavioral_changes: false,
      mmse_score: null, moca_score: null,
    },
  })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/")
  }, [status, router])

  useEffect(() => () => {
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current)
    if (faceTimerRef.current) clearInterval(faceTimerRef.current)
    faceStreamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  // Voice handlers
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceChunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => { if (e.data.size > 0) voiceChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        setVoiceBlob(new Blob(voiceChunksRef.current, { type: "audio/webm" }))
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start(100)
      voiceRecorderRef.current = recorder
      setVoiceTimer(0)
      voiceTimerRef.current = setInterval(() => setVoiceTimer(t => t + 1), 1000)
      setIsVoiceRecording(true)
    } catch { /* mic denied */ }
  }
  const stopVoiceRecording = () => {
    voiceRecorderRef.current?.stop()
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current)
    setIsVoiceRecording(false)
  }
  const resetVoice = () => { setVoiceBlob(null); setVoiceTimer(0) }

  // Face handlers
  const startCamera = async () => {
    try {
      setCameraError("")
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      faceStreamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      setCameraActive(true)
    } catch {
      setCameraError("Camera access was denied. Please check your browser settings.")
    }
  }
  const startFaceRecording = () => {
    if (!faceStreamRef.current) return
    faceChunksRef.current = []
    const recorder = new MediaRecorder(faceStreamRef.current)
    recorder.ondataavailable = (e) => { if (e.data.size > 0) faceChunksRef.current.push(e.data) }
    recorder.onstop = () => setFaceBlob(new Blob(faceChunksRef.current, { type: "video/webm" }))
    recorder.start(100)
    faceRecorderRef.current = recorder
    setFaceTimer(0)
    faceTimerRef.current = setInterval(() => setFaceTimer(t => t + 1), 1000)
    setIsFaceRecording(true)
  }
  const stopFaceRecording = () => {
    faceRecorderRef.current?.stop()
    if (faceTimerRef.current) clearInterval(faceTimerRef.current)
    setIsFaceRecording(false)
    faceStreamRef.current?.getTracks().forEach(t => t.stop())
    setCameraActive(false)
  }
  const resetFace = async () => { setFaceBlob(null); setFaceTimer(0); await startCamera() }

  const handleFileChange = (file: File | null, setFile: (f: File | null) => void, setPreview: (p: string | null) => void) => {
    if (!file) { setFile(null); setPreview(null); return }
    setFile(file)
    if (file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else setPreview(null)
  }

  const handleNext = async () => {
    const fields = STEP_FIELDS[step]
    if (fields.length > 0 && !(await trigger(fields))) return
    setStep(s => Math.min(s + 1, TOTAL_STEPS))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const handleBack = () => { setStep(s => Math.max(s - 1, 1)); window.scrollTo({ top: 0, behavior: "smooth" }) }

  const onSubmit = async (data: FormValues) => {
    try {
      setApiError("")
      await update()
      const fd = new FormData()
      for (const [key, val] of Object.entries(data)) {
        if (val !== null && val !== undefined) fd.append(key, String(val))
      }
      if (voiceBlob) fd.append("voice_recording", voiceBlob, "voice.webm")
      if (faceBlob) fd.append("face_video", faceBlob, "face.webm")
      if (eegFile) fd.append("eeg_file", eegFile)
      if (mriFile) fd.append("mri_file", mriFile)

      const res = await api.post("/patients/", fd)
      const patientId = res?.data?.id
      router.push(`/${locale}/diagnosis-result${patientId ? `?id=${patientId}` : ""}`)
    } catch (error: unknown) {
      console.error(error)
      setApiError(formatApiError(error))
      if (isBackendAuthError(error)) setTimeout(() => router.replace(`/${locale}`), 1200)
    }
  }

  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
  }

  const currentStep = STEPS[step - 1]
  const StepIcon = currentStep.icon

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step dots */}
      <div className="flex items-center justify-center gap-1 mb-6">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isActive = step === s.id, isDone = step > s.id
          return (
            <div key={s.id} className="flex items-center">
              <div title={s.title} className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ring-2",
                isActive ? "bg-blue-600 ring-blue-600 shadow-lg shadow-blue-200 scale-110"
                  : isDone ? "bg-emerald-500 ring-emerald-500" : "bg-white ring-slate-200")}>
                {isDone ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-slate-400")} />}
              </div>
              {i < STEPS.length - 1 && <div className={cn("h-0.5 w-5 mx-0.5 rounded-full transition-all duration-500", step > s.id ? "bg-emerald-400" : "bg-slate-200")} />}
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 h-1.5 rounded-full mb-6 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-700 h-full rounded-full transition-all duration-500" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 px-7 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm"><StepIcon className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-blue-200 text-xs font-medium tracking-wide uppercase">Step {step} / {TOTAL_STEPS}</p>
              <h2 className="text-lg font-bold leading-tight">{currentStep.title}</h2>
            </div>
          </div>
        </div>

        <div className="px-7 py-7">
          {apiError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 flex items-start rounded-lg">
              <AlertCircle className="text-red-500 w-4 h-4 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-red-700 text-sm break-all">{apiError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-5">
                <Field label="Age" required error={errors.age?.message}>
                  <input type="number" min="18" max="120" placeholder="e.g. 65" className={inputCls(!!errors.age)} {...register("age", { valueAsNumber: true })} />
                </Field>
                <Field label="Gender" required error={errors.gender && "Please select a gender"}>
                  <select className={selectCls(!!errors.gender)} {...register("gender")}>
                    <option value="">Select...</option><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
                  </select>
                </Field>
                <Field label="Education level" required error={errors.education_level && "Please select an education level"}>
                  <select className={selectCls(!!errors.education_level)} {...register("education_level")}>
                    <option value="">Select...</option><option value="None">None</option><option value="Primary">Primary</option>
                    <option value="Secondary">Secondary (school)</option><option value="Higher">Higher (university)</option>
                  </select>
                </Field>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="space-y-2.5">
                <p className="text-slate-500 text-sm mb-4">Mark any conditions you have. Accurate answers improve assessment accuracy.</p>
                {[
                  { id: "hypertension", label: "Hypertension", desc: "High blood pressure (over 130/80 mmHg)" },
                  { id: "diabetes", label: "Diabetes", desc: "Type 1 or type 2 diabetes" },
                  { id: "history_of_stroke", label: "History of stroke", desc: "Prior cerebrovascular event" },
                  { id: "depression", label: "Depression", desc: "Diagnosed or under treatment" },
                  { id: "family_history_of_alzheimers", label: "Family history of Alzheimer's", desc: "Parent or sibling affected" },
                  { id: "alcohol_use", label: "Alcohol use", desc: "Regular or heavy drinking" },
                ].map(item => <CheckItem key={item.id} item={item} register={register} />)}
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="space-y-2.5">
                <p className="text-slate-500 text-sm mb-4">Have you noticed any of the following in the last 6 months?</p>
                {[
                  { id: "memory_complaints", label: "Memory problems", desc: "Frequent forgetfulness, forgetting important things" },
                  { id: "language_difficulties", label: "Language difficulties", desc: "Trouble finding words or finishing sentences" },
                  { id: "orientation_problems", label: "Orientation problems", desc: "Getting lost in familiar places, losing track of dates" },
                  { id: "mood_behavioral_changes", label: "Mood / behavioral changes", desc: "Increased irritability, anxiety, personality change" },
                ].map(item => <CheckItem key={item.id} item={item} register={register} />)}
              </div>
            )}

            {/* STEP 4 */}
            {step === 4 && (
              <div className="space-y-6">
                <Field label="Smoking status" required error={errors.smoking_status && "Please select a smoking status"}>
                  <select className={selectCls(!!errors.smoking_status)} {...register("smoking_status")}>
                    <option value="">Select...</option><option value="Never">Never smoked</option>
                    <option value="Former">Former smoker</option><option value="Current">Current smoker</option>
                  </select>
                </Field>
                <Field label="Sleep hours per day" required error={errors.sleep_hours_per_day && "Enter sleep hours (0–24)"}>
                  <div className="flex items-center gap-3">
                    <input type="number" min="0" max="24" placeholder="8" className={inputCls(!!errors.sleep_hours_per_day)} {...register("sleep_hours_per_day", { valueAsNumber: true })} />
                    <span className="text-slate-500 text-sm font-medium whitespace-nowrap">hours / day</span>
                  </div>
                </Field>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Physical activity level <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { val: "None", label: "None", desc: "No exercise at all" },
                      { val: "Low", label: "Low", desc: "Walking 1–2 times a week" },
                      { val: "Moderate", label: "Moderate", desc: "Exercise 3–4 times a week" },
                      { val: "High", label: "High", desc: "Daily active workouts" },
                    ].map(item => (
                      <label key={item.val} className="relative flex flex-col p-3.5 rounded-xl border-2 border-slate-200 cursor-pointer hover:border-blue-300 transition-all has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                        <input type="radio" value={item.val} className="absolute opacity-0" {...register("physical_activity")} />
                        <span className="font-bold text-slate-800 text-sm">{item.label}</span>
                        <span className="text-slate-400 text-xs mt-0.5">{item.desc}</span>
                      </label>
                    ))}
                  </div>
                  {errors.physical_activity && <p className="text-red-500 text-xs mt-1">Please select an activity level</p>}
                </div>
              </div>
            )}

            {/* STEP 6: Speech */}
            {step === 6 && (
              <div className="space-y-5">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-blue-900 font-semibold text-sm mb-1">Read the passage aloud — in English</p>
                  <p className="text-blue-700 text-sm leading-relaxed">Please read the text below clearly and at a natural pace. This recording is analyzed for speech and language biomarkers (pauses, fluency, vocabulary).</p>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border-l-4 border-blue-400">
                  <p className="text-slate-700 leading-relaxed text-sm italic">&ldquo;{SPEECH_PASSAGE}&rdquo;</p>
                </div>
                <div className="flex flex-col items-center gap-5 py-4">
                  {!voiceBlob ? (
                    <>
                      <button type="button" onClick={isVoiceRecording ? stopVoiceRecording : startVoiceRecording}
                        className={cn("w-20 h-20 rounded-full flex flex-col items-center justify-center gap-1 shadow-lg transition-all font-semibold",
                          isVoiceRecording ? "bg-red-500 hover:bg-red-600 text-white ring-4 ring-red-200 animate-pulse" : "bg-blue-600 hover:bg-blue-700 text-white ring-4 ring-blue-100")}>
                        {isVoiceRecording ? <><Square className="w-6 h-6" /><span className="text-[10px]">Stop</span></> : <><Mic className="w-7 h-7" /><span className="text-[10px]">Start</span></>}
                      </button>
                      {isVoiceRecording && (
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="font-mono font-bold text-2xl text-slate-700 tabular-nums">{formatTime(voiceTimer)}</span></div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-3 py-2">
                      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200"><CheckCircle2 className="w-4 h-4" /><span className="font-semibold text-sm">Recorded ({formatTime(voiceTimer)})</span></div>
                      <button type="button" onClick={resetVoice} className="flex items-center gap-1.5 text-slate-500 hover:text-red-500 transition-colors text-sm"><RefreshCw className="w-3.5 h-3.5" /> Re-record</button>
                    </div>
                  )}
                  {voiceAudioURL && (<div className="w-full"><p className="text-xs text-slate-400 mb-2 text-center">Listen to your recording:</p><audio controls src={voiceAudioURL} className="w-full h-10 rounded-xl" /></div>)}
                </div>
                <p className="text-center text-slate-400 text-xs">* Optional — you can skip with &quot;Next&quot;, but speech is a key biomarker.</p>
              </div>
            )}

            {/* STEP 7: Face */}
            {step === 7 && (
              <div className="space-y-5">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-blue-900 font-semibold text-sm mb-1">Facial expression task</p>
                  <p className="text-blue-700 text-sm">Facing the camera, show in sequence: <strong>smile</strong>, <strong>surprise</strong>, <strong>frown</strong>, and a <strong>neutral expression</strong> (~3 seconds each). We measure facial expressivity and blink dynamics.</p>
                </div>
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video shadow-inner">
                  {!cameraActive && !faceBlob ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
                      <div className="p-4 bg-white/10 rounded-2xl"><Camera className="w-12 h-12 text-slate-400" /></div>
                      {cameraError ? <p className="text-red-400 text-sm">{cameraError}</p> : <button type="button" onClick={startCamera} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors">Enable camera</button>}
                    </div>
                  ) : faceBlob ? <video src={faceVideoURL!} controls className="w-full h-full object-cover" />
                    : <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />}
                  {isFaceRecording && <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow"><div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />REC {formatTime(faceTimer)}</div>}
                </div>
                {cameraActive && !faceBlob && (
                  <div className="flex justify-center">
                    <button type="button" onClick={isFaceRecording ? stopFaceRecording : startFaceRecording}
                      className={cn("flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm transition-all shadow",
                        isFaceRecording ? "bg-red-500 hover:bg-red-600 text-white ring-4 ring-red-100" : "bg-blue-600 hover:bg-blue-700 text-white ring-4 ring-blue-100")}>
                      {isFaceRecording ? <><Square className="w-4 h-4" /> Stop recording</> : <><Camera className="w-4 h-4" /> Start recording</>}
                    </button>
                  </div>
                )}
                {faceBlob && (
                  <div className="flex justify-center items-center gap-4">
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200"><CheckCircle2 className="w-4 h-4" /><span className="font-semibold text-sm">Saved ({formatTime(faceTimer)})</span></div>
                    <button type="button" onClick={resetFace} className="flex items-center gap-1.5 text-slate-500 hover:text-red-500 transition-colors text-sm"><RefreshCw className="w-3.5 h-3.5" /> Re-record</button>
                  </div>
                )}
                <p className="text-center text-slate-400 text-xs">* Optional — you can skip with &quot;Next&quot;.</p>
              </div>
            )}

            {/* STEP 5: EEG + Clinical */}
            {step === 5 && (
              <div className="space-y-7">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-semibold text-slate-700">EEG signal file <span className="text-slate-400 font-normal">(CSV / EDF)</span></label>
                    <a href={`${API_BASE}/eeg/sample/?cls=ad`} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                      <Download className="w-3.5 h-3.5" /> Download sample EEG
                    </a>
                  </div>
                  <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 rounded-xl p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                    {eegFile ? (
                      <div className="flex items-center gap-2 text-blue-600"><CheckCircle2 className="w-5 h-5" /><span className="text-sm font-medium">{eegFile.name}</span></div>
                    ) : (
                      <>
                        <div className="p-3 bg-slate-100 rounded-xl"><Upload className="w-7 h-7 text-slate-400" /></div>
                        <div className="text-center">
                          <p className="text-slate-600 font-medium text-sm">Upload your EEG recording</p>
                          <p className="text-slate-400 text-xs mt-0.5">CSV with channel columns (Fp1, Fp2 …) @ 256 Hz, or EDF</p>
                        </div>
                      </>
                    )}
                    <input type="file" className="hidden" accept=".csv,.edf,.txt" onChange={e => handleFileChange(e.target.files?.[0] ?? null, setEegFile, setEegPreview)} />
                  </label>
                  {eegFile && <button type="button" onClick={() => { setEegFile(null); setEegPreview(null) }} className="mt-1.5 text-xs text-red-400 hover:text-red-600 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Remove file</button>}
                  <p className="text-slate-400 text-xs mt-2">No EEG of your own? Use the sample file to see the analysis. The signal is classified with a model trained on the Kaggle EEG Alzheimer's dataset.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">MRI image <span className="text-slate-400 font-normal">(optional, stored only)</span></label>
                  <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 rounded-xl p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                    {mriPreview ? <img src={mriPreview} alt="MRI" className="max-h-36 rounded-lg object-contain" />
                      : mriFile ? <div className="flex items-center gap-2 text-blue-600"><CheckCircle2 className="w-5 h-5" /><span className="text-sm font-medium">{mriFile.name}</span></div>
                        : <><div className="p-3 bg-slate-100 rounded-xl"><FileImage className="w-7 h-7 text-slate-400" /></div><div className="text-center"><p className="text-slate-600 font-medium text-sm">Upload an MRI image</p><p className="text-slate-400 text-xs mt-0.5">PNG, JPG, DICOM — max 20 MB</p></div></>}
                    <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.dcm,.bmp,.tiff" onChange={e => handleFileChange(e.target.files?.[0] ?? null, setMriFile, setMriPreview)} />
                  </label>
                  {mriFile && <button type="button" onClick={() => { setMriFile(null); setMriPreview(null) }} className="mt-1.5 text-xs text-red-400 hover:text-red-600 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Remove file</button>}
                </div>

                <div className="pt-5 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-1"><Stethoscope className="w-4 h-4 text-slate-500" /><h4 className="font-semibold text-slate-700 text-sm">Clinical scores</h4><span className="text-slate-400 text-xs">(optional)</span></div>
                  <p className="text-slate-400 text-xs mb-4">If assessed by a clinician, enter the values</p>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">MMSE (0–30)</label>
                      <input type="number" min="0" max="30" step="0.1" placeholder="—" className={inputCls(false)} {...register("mmse_score", { valueAsNumber: true, setValueAs: v => v === "" ? null : parseFloat(v) })} />
                      <p className="text-slate-400 text-[10px] mt-1">Mini-Mental State Exam</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">MoCA (0–30)</label>
                      <input type="number" min="0" max="30" step="0.1" placeholder="—" className={inputCls(false)} {...register("moca_score", { valueAsNumber: true, setValueAs: v => v === "" ? null : parseFloat(v) })} />
                      <p className="text-slate-400 text-[10px] mt-1">Montreal Cognitive Assessment</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between pt-5 border-t border-slate-100">
              {step > 1 ? (
                <button type="button" onClick={handleBack} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:border-slate-300 hover:bg-slate-50 transition-all"><ChevronLeft className="w-4 h-4" /> Back</button>
              ) : <div />}
              {step < TOTAL_STEPS ? (
                <button type="button" onClick={handleNext} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-blue-200/60 transition-all active:scale-95">Next <ChevronRight className="w-4 h-4" /></button>
              ) : (
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-8 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-emerald-200/60 transition-all active:scale-95">
                  {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <><CheckCircle2 className="w-4 h-4" /> Analyze</>}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, error, children }: any) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

function CheckItem({ item, register }: any) {
  return (
    <label className="flex items-start gap-3.5 p-4 rounded-xl border-2 border-slate-200 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-all has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
      <input type="checkbox" className="w-5 h-5 mt-0.5 accent-blue-600 flex-shrink-0" {...register(item.id)} />
      <div><p className="font-semibold text-slate-800 text-sm">{item.label}</p><p className="text-slate-400 text-xs mt-0.5">{item.desc}</p></div>
    </label>
  )
}
