"use client";

import OnboardingForm from '@/components/OnboardingForm';
import { Brain, Home, Activity, PlusCircle, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function OnboardingPage() {
  const { locale } = useParams();

  return (
    <div className="min-h-screen bg-slate-50/80">
      {/* Sidebar - Same as Profile */}
      <nav className="fixed top-0 left-0 bottom-0 w-20 lg:w-72 bg-white border-r border-slate-200 flex flex-col p-6 z-50">
        <div className="flex items-center gap-3 px-2 mb-12">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100 cursor-pointer" onClick={() => window.location.href=`/${locale}`}>
            <Brain className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight hidden lg:block text-slate-900">DementiaCare</span>
        </div>
        
        <div className="flex-1 space-y-3">
          <NavItem icon={<Home className="w-5 h-5" />} label="Bosh sahifa" href={`/${locale}`} />
          <NavItem icon={<Activity className="w-5 h-5" />} label="Dashboard" href={`/${locale}/profile`} />
          <NavItem icon={<PlusCircle className="w-5 h-5" />} label="Yangi test" href={`/${locale}/onboarding`} active />
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

      <main className="pl-20 lg:pl-72 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-4xl animate-fade-in">
          <header className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Yangi So'rovnoma</h1>
            <p className="text-slate-500 font-medium italic">Tibbiy ma'lumotlaringizni to'ldiring</p>
          </header>
          <OnboardingForm />
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
