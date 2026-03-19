"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, ChevronRight, ChevronLeft, AlertCircle } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslations } from 'next-intl'
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation";

export default function OnboardingForm() {
  const t = useTranslations('Form');
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale;

  const [step, setStep] = useState(1)
  const [isSuccess, setIsSuccess] = useState(false)
  const [apiError, setApiError] = useState("")

  const genderEnum = z.enum(["M", "F", "O"]);
  const educationEnum = z.enum(["None", "Primary", "Secondary", "Higher"]);
  const smokingEnum = z.enum(["Never", "Former", "Current"]);

  const formSchema = z.object({
    age: z.coerce.number().min(1, "Required"),
    gender: genderEnum.refine(val => val !== undefined, { message: "Required" }),
    education_level: educationEnum.refine(val => val !== undefined, { message: "Required" }),
    hypertension: z.boolean().default(false),
    diabetes: z.boolean().default(false),
    history_of_stroke: z.boolean().default(false),
    depression: z.boolean().default(false),
    family_history_of_alzheimers: z.boolean().default(false),
    smoking_status: smokingEnum.refine(val => val !== undefined, { message: "Required" }),
    sleep_hours_per_day: z.coerce.number().min(0).max(24),
    mmse_score: z.union([z.coerce.number().min(0).max(30), z.literal(""), z.undefined()]),
    moca_score: z.union([z.coerce.number().min(0).max(30), z.literal(""), z.undefined()]),
  })

  type FormData = z.infer<typeof formSchema>

  const { register, handleSubmit, formState: { errors, isSubmitting }, trigger } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hypertension: false, diabetes: false, history_of_stroke: false,
      depression: false, family_history_of_alzheimers: false,
      mmse_score: undefined, moca_score: undefined
    }
  })

  if (status === "unauthenticated") {
    router.push('/');
    return null;
  }

  const handleNext = async () => {
    let fieldsToValidate: (keyof FormData)[] = [];
    if (step === 1) fieldsToValidate = ["age", "gender", "education_level"];
    if (step === 2) fieldsToValidate = ["hypertension", "diabetes", "history_of_stroke", "depression", "family_history_of_alzheimers"];
    
    const isValid = await trigger(fieldsToValidate)
    if (isValid) setStep(step + 1)
  }

  const onSubmit = async (data: FormData) => {
    try {
      setApiError("")
      
      const payload = {
        ...data,
        mmse_score: data.mmse_score === "" ? null : data.mmse_score,
        moca_score: data.moca_score === "" ? null : data.moca_score,
      }
      
      await api.post("/patients/", payload)
      
      router.push(`/${locale}/diagnosis-result`);
    } catch (error: any) {
      console.error(error)
      setApiError(error.response?.data ? JSON.stringify(error.response.data) : "An error occurred submitting the form.")
    }
  }

  if (isSuccess) {
    return (
      <Card className="max-w-xl mx-auto text-center py-12">
        <CardContent className="flex flex-col items-center justify-center space-y-6">
          <CheckCircle2 className="w-24 h-24 text-green-500" />
          <h2 className="text-4xl font-bold text-slate-900">{t('success_title')}</h2>
          <p className="text-xl text-slate-600">{t('success_desc')}</p>
          <Button onClick={() => window.location.reload()} className="mt-8 px-12">{t('new_assessment')}</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto shadow-2xl">
      <CardHeader className="bg-white rounded-t-2xl border-b pb-6">
        <CardTitle className="text-3xl text-center text-blue-950 font-extrabold mb-2">
          {step === 1 && t('step_1')}
          {step === 2 && t('step_2')}
          {step === 3 && t('step_3')}
        </CardTitle>
        <div className="w-full bg-slate-100 h-4 rounded-full mt-6 overflow-hidden">
          <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }}></div>
        </div>
      </CardHeader>
      <CardContent className="p-8 md:p-12">
        {apiError && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 flex items-start rounded">
            <AlertCircle className="text-red-500 w-6 h-6 mr-3 mt-0.5 flex-shrink-0" />
            <p className="text-red-700 font-medium break-all">{apiError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <div>
                <Label htmlFor="age">{t('age')}</Label>
                <Input id="age" type="number" {...register("age")} />
                {errors.age && <p className="text-red-500 text-sm mt-1">{errors.age.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="gender">{t('gender')}</Label>
                <select id="gender" className="flex h-14 w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" {...register("gender")}>
                  <option value="">{t('select')}</option>
                  <option value="M">{t('male')}</option>
                  <option value="F">{t('female')}</option>
                  <option value="O">{t('other')}</option>
                </select>
                {errors.gender && <p className="text-red-500 text-sm mt-1">{errors.gender.message}</p>}
              </div>

              <div>
                <Label htmlFor="education_level">{t('education')}</Label>
                <select id="education_level" className="flex h-14 w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" {...register("education_level")}>
                  <option value="">{t('select')}</option>
                  <option value="None">{t('edu_none')}</option>
                  <option value="Primary">{t('edu_primary')}</option>
                  <option value="Secondary">{t('edu_secondary')}</option>
                  <option value="Higher">{t('edu_higher')}</option>
                </select>
                {errors.education_level && <p className="text-red-500 text-sm mt-1">{errors.education_level.message}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
              {[
                { id: "hypertension", label: t('hypertension') },
                { id: "diabetes", label: t('diabetes') },
                { id: "history_of_stroke", label: t('stroke') },
                { id: "depression", label: t('depression') },
                { id: "family_history_of_alzheimers", label: t('family_alzheimers') },
              ].map((item) => (
                <label key={item.id} className="flex items-center space-x-4 border-2 border-slate-200 p-5 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input type="checkbox" className="w-6 h-6 text-blue-600 rounded-md border-slate-300 focus:ring-blue-600" {...register(item.id as any)} />
                  <span className="text-xl font-medium text-slate-800">{item.label}</span>
                </label>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
              <div>
                <Label htmlFor="smoking_status">{t('smoking')}</Label>
                <select id="smoking_status" className="flex h-14 w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" {...register("smoking_status")}>
                  <option value="">{t('select')}</option>
                  <option value="Never">{t('smoke_never')}</option>
                  <option value="Former">{t('smoke_former')}</option>
                  <option value="Current">{t('smoke_current')}</option>
                </select>
                {errors.smoking_status && <p className="text-red-500 text-sm mt-1">{errors.smoking_status.message}</p>}
              </div>

              <div>
                <Label htmlFor="sleep_hours_per_day">{t('sleep_hours')}</Label>
                <Input id="sleep_hours_per_day" type="number" {...register("sleep_hours_per_day")} />
                {errors.sleep_hours_per_day && <p className="text-red-500 text-sm mt-1">{errors.sleep_hours_per_day.message}</p>}
              </div>
              
              <div className="pt-6 border-t border-slate-200">
                <h4 className="text-xl font-semibold mb-6 text-slate-700">{t('clinical_scores')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <Label htmlFor="mmse_score">MMSE (0-30)</Label>
                    <Input id="mmse_score" type="number" step="0.1" {...register("mmse_score")} />
                  </div>
                  <div>
                    <Label htmlFor="moca_score">MoCA (0-30)</Label>
                    <Input id="moca_score" type="number" step="0.1" {...register("moca_score")} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-10 flex justify-between">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="bg-slate-100 hover:bg-slate-200 text-slate-900 border-0 px-8">
                <ChevronLeft className="w-5 h-5 mr-2" /> {t('back')}
              </Button>
            ) : <div></div>}

            {step < 3 ? (
              <Button type="button" onClick={handleNext} className="px-10 text-xl font-semibold">
                {t('next')} <ChevronRight className="w-6 h-6 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting} className="px-12 bg-green-600 hover:bg-green-700 text-xl font-semibold">
                {isSubmitting ? t('submitting') : t('submit')} <CheckCircle2 className="w-6 h-6 ml-2" />
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
