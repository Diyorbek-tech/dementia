---
tags: [frontend, architecture]
created: 2026-06-05
up: "[[Home]]"
---

# Frontend Overview

Next.js (App Router) ilovasi `frontend/` ichida. Til: TypeScript. Manba: `frontend/src/`.

## Marshrutlar (`src/app/[locale]/`)
| Yo'l | Sahifa | Yozuv |
|---|---|---|
| `/[locale]` | Bosh / login sahifasi | |
| `/[locale]/onboarding` | So'rovnoma | [[Onboarding Form]] |
| `/[locale]/diagnosis-result` | Tashxis natijasi | [[Diagnosis Result Page]] |
| `/[locale]/profile` | Dashboard / tarix | |
| `/api/auth/[...nextauth]` | NextAuth handler | [[Auth and Session]] |

`[locale]` ∈ `{uz, en, ru}`, default `uz` (`src/middleware.ts`, `next-intl`).

## Asosiy modullar
| Fayl | Vazifa |
|---|---|
| `components/OnboardingForm.tsx` | 7 bosqichli so'rovnoma + submit |
| `components/Providers.tsx` | `SessionProvider` + `SessionRefresher` |
| `components/SessionRefresher.tsx` | `update()` ni global ro'yxatga oladi |
| `lib/api.ts` | Axios klient, JWT interceptor, `formatApiError` |
| `lib/session-refresh.ts` | Sessiya yangilash ko'prigi |

## Saqlash bilan bog'liq oqim
1. [[Onboarding Form]] `onSubmit` → `POST /patients/` → javobdan `id` oladi → `?id=` bilan natija sahifasiga o'tadi.
2. [[Diagnosis Result Page]] → `POST /diagnose/ {patient: id}` (idempotent) → hisobotni ko'rsatadi.

To'liq oqim: [[Assessment Save Flow]].

## Typecheck / build
```bash
cd frontend
npx tsc --noEmit      # tiplarni tekshirish
npm run dev           # lokal server :3000
npm run build         # production build
```
Batafsil: [[Local Development]].
