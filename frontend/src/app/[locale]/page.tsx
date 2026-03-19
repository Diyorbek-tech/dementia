"use client";

import { useTranslations } from 'next-intl';
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Brain, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  Globe, 
  CheckCircle2, 
  Activity,
  ChevronRight,
  User as UserIcon,
  LayoutDashboard
} from 'lucide-react';

export default function Home() {
  const t = useTranslations('Home');
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'uz';

  const handleLangChange = (newLocale: string) => {
    const parts = pathname.split('/');
    parts[1] = newLocale;
    router.push(parts.join('/'));
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => router.push(`/${locale}`)}>
            <div className="bg-indigo-600 p-2 rounded-xl group-hover:rotate-12 transition-transform">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">DementiaCare</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <Link href={`/${locale}#features`} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Imkoniyatlar</Link>
            <Link href={`/${locale}#process`} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Qanday ishlaydi</Link>
            <div className="h-4 w-px bg-slate-200"></div>
            
            <div className="flex items-center gap-2">
              {['uz', 'en', 'ru'].map((l) => (
                <button
                  key={l}
                  onClick={() => handleLangChange(l)}
                  className={`text-xs font-bold px-2 py-1 rounded-md transition-all ${
                    locale === l 
                      ? "bg-indigo-600 text-white" 
                      : "text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {session ? (
              <div className="flex items-center gap-4 ml-4">
                <Link href={`/${locale}/profile`}>
                  <button className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-full text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all">
                    <LayoutDashboard className="w-4 h-4" /> Dashboard
                  </button>
                </Link>
                <button onClick={() => signOut()} className="text-sm font-medium text-red-500 hover:text-red-600">
                  {t('logout')}
                </button>
              </div>
            ) : (
              <button 
                onClick={() => signIn('google')}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-slate-800 hover:shadow-lg transition-all flex items-center gap-2"
              >
                {t('login_button')} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="max-w-2xl text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-bold mb-6 animate-fade-in">
                <Activity className="w-4 h-4 animate-pulse" /> AI asosidagi erta aniqlash
              </div>
              <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] mb-8 tracking-tight">
                Kognitiv salomatlik <span className="text-indigo-600">kelajagi</span> shu yerda.
              </h1>
              <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-lg">
                Dementia alomatlarini erta aniqlash va kognitiv salomatligingizni ilg'or texnologiyalar yordamida monitoring qiling.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                {session ? (
                  <button 
                    onClick={() => router.push(`/${locale}/onboarding`)}
                    className="bg-indigo-600 text-white px-10 py-5 rounded-2xl text-lg font-bold hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2 group"
                  >
                    {t('start_assessment')}
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <button 
                    onClick={() => signIn('google')}
                    className="bg-slate-900 text-white px-10 py-5 rounded-2xl text-lg font-bold hover:bg-slate-800 hover:shadow-xl transition-all flex items-center justify-center gap-3"
                  >
                     <img src="https://authjs.dev/img/providers/google.svg" alt="Google" className="w-6 h-6" />
                     {t('login_button')}
                  </button>
                )}
                <button className="bg-white border border-slate-200 text-slate-700 px-10 py-5 rounded-2xl text-lg font-bold hover:bg-slate-50 transition-all">
                  Batafsil ma'lumot
                </button>
              </div>

              <div className="mt-12 flex items-center gap-6 justify-center lg:justify-start">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`w-10 h-10 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden`}>
                       <UserIcon className="w-6 h-6 text-slate-400" />
                    </div>
                  ))}
                </div>
                <p className="text-sm font-medium text-slate-500">
                  <span className="text-slate-900 font-bold">1,200+</span> bemorlar ishonchi
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-indigo-500/10 blur-3xl rounded-full"></div>
              <div className="relative bg-white p-2 rounded-[2.5rem] shadow-2xl shadow-indigo-200/50 border border-slate-100 overflow-hidden group">
                <img 
                  src="/images/hero_brain.png" 
                  alt="Neural Visualization" 
                  className="w-full h-auto rounded-[2rem] transform group-hover:scale-105 transition-transform duration-700" 
                />
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white/50 shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-500/20 p-2 rounded-lg">
                        <ShieldCheck className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Xavfsiz va aniq</p>
                        <p className="text-sm font-bold text-slate-900">Tibbiy darajadagi tahlil</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-base font-bold text-indigo-600 tracking-widest uppercase mb-4">Imkoniyatlar</h2>
            <p className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
              Sog'ligingizni boshqarish uchun barcha kerakli vositalar.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Brain className="w-8 h-8" />}
              title="Klinik So'rovnomalar"
              desc="MMSE va MoCA kabi standart tibbiy testlar yordamida holatingizni baholang."
            />
            <FeatureCard 
              icon={<Zap className="w-8 h-8" />}
              title="Tezkor Natijalar"
              desc="Sizning tibbiy profilingiz bir necha daqiqa ichida tahlil qilinadi."
            />
            <FeatureCard 
              icon={<ShieldCheck className="w-8 h-8" />}
              title="Maxfiylik"
              desc="Sizning barcha ma'lumotlaringiz shifrlangan va xavfsiz holatda saqlanadi."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-indigo-600 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden group">
             <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-indigo-400/20 blur-3xl rounded-full transition-transform group-hover:scale-150 duration-700"></div>
             
             <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-8 relative z-10 tracking-tight leading-tight">
               Bugun birinchi qadamni <br className="hidden md:block" /> tashlashga tayyormisiz?
             </h2>
             
             <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
               {session ? (
                 <button 
                  onClick={() => router.push(`/${locale}/onboarding`)}
                  className="bg-white text-indigo-600 px-10 py-5 rounded-2xl text-lg font-bold hover:bg-slate-50 hover:shadow-2xl transition-all"
                 >
                   Hozir boshlash
                 </button>
               ) : (
                 <button 
                  onClick={() => signIn('google')}
                  className="bg-white text-indigo-600 px-10 py-5 rounded-2xl text-lg font-bold hover:bg-slate-50 hover:shadow-2xl transition-all"
                 >
                   Google orqali ro'yxatdan o'tish
                 </button>
               )}
               <button className="bg-indigo-700 text-white px-10 py-5 rounded-2xl text-lg font-bold hover:bg-indigo-800 transition-all border border-indigo-500/50">
                 Mutaxassis bilan bog'lanish
               </button>
             </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-100 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Brain className="w-5 h-5 text-indigo-600" />
          <span className="font-bold text-slate-900 tracking-tight">DementiaCare</span>
        </div>
        <p className="text-slate-500 text-sm">
          &copy; 2026 DementiaCare Platformasi. Barcha huquqlar himoyalangan.
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: any) {
  return (
    <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 hover:-translate-y-2 transition-all duration-500 group">
      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-8 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-500">
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">{title}</h3>
      <p className="text-slate-600 leading-relaxed">
        {desc}
      </p>
    </div>
  );
}
