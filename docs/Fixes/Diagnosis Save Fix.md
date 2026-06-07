---
tags: [bugfix, diagnosis, core, postmortem]
created: 2026-06-05
up: "[[Home]]"
aliases: ["Saqlash muammosi", "Diagnosis Save Bug"]
---

# Diagnosis Save Fix ⭐

> [!abstract] Muammo (foydalanuvchi so'zlari bilan)
> "Tashxis topshirishni oxirgi bosqichida **saqlash** qismida yaxshi ishlamaydi."

Bu yozuv shu muammoning **sabab-tahlili** va qo'llangan **pro yechim**ni hujjatlashtiradi. Oqim: [[Assessment Save Flow]].

## Asosiy sabab (root cause)

Saqlash ikki alohida bosqichga bo'lingan va ularning hech biri ishonchli emas edi:

1. `OnboardingForm` `POST /patients/` qiladi (faqat `Patient` saqlanadi).
2. `diagnosis-result` sahifasi alohida `POST /diagnose/` qiladi, u **har chaqiruvda yangi** `DiagnosisReport` yaratadi (`random.randint`, `random.sample` bilan).

Bu quyidagi nosozliklarga olib keldi 👇

## Topilgan nuqsonlar va tuzatishlar

### 1. ❌ Idempotentlik yo'q → dublikat hisobotlar
- **Eski:** `DiagnosisReport.objects.create(...)` har `/diagnose/` chaqiruvida. React 18 StrictMode `useEffect`ni ikki marta chaqirib, ikki hisobot yaratardi. Refresh yana yaratardi.
- **Yangi:** `DiagnosisReport.patient` → **`OneToOneField`** (DB UNIQUE). `get_diagnosis()` `get_or_create` + `IntegrityError` ushlash bilan **idempotent**. Frontendda `startedRef` guard.
- Fayllar: `models.py`, `services.py`, `diagnosis-result/page.tsx`.

### 2. ❌ Determinizm yo'q → refresh natijani o'zgartiradi
- **Eski:** `risk_percentage = min(score + random.randint(-5, 5), 98)`.
- **Yangi:** `compute_risk()` — sof funksiya, tasodif yo'q. Bir xil kirish → bir xil natija.
- Fayl: `services.py`. Test: `test_scoring_is_deterministic`.

### 3. ❌ Atomik emas → yarim saqlash
- **Eski:** Patient saqlanardi, lekin report alohida/keyin — biri muvaffaqiyatsiz bo'lsa nomuvofiqlik.
- **Yangi:** `perform_create` → `transaction.atomic` ichida Patient + report birga. Xato bo'lsa **to'liq rollback**.
- Fayl: `views.py`. Test: `test_save_is_atomic_when_diagnosis_fails`.

### 4. ❌ Noto'g'ri baholashga tashxis
- **Eski:** `/diagnose/` har doim `latest('created_at')`ni oldi — poygada noto'g'ri baholash.
- **Yangi:** `onSubmit` javobdan `id` oladi → `?id=` uzatadi → `/diagnose/ {patient: id}` aniq baholashni hedeflar (user-scoped).
- Fayllar: `OnboardingForm.tsx`, `diagnosis-result/page.tsx`, `views.py`.

### 5. ❌ Xatolar yashirin
- **Eski:** `diagnose_patient` `except Exception: return {"error": str(e)}, 500` — frontend `error` kalitini o'qimasdi (faqat `detail`). Natija: umumiy "Xatolik" ekrani, sababsiz.
- **Yangi:**
  - Backend toza `{"detail": ...}` qaytaradi (400/404/500), `LOGGING` + `logger.exception` bilan kuzatiladi.
  - Frontend markazlashtirilgan `formatApiError` — DRF maydon-xatolari, `detail`, 401/404/network → o'zbekcha xabar.
  - Natija sahifasi `errorMsg`ni ko'rsatadi (umumiy matn emas).
- Fayllar: `views.py`, `settings.py` (LOGGING), `lib/api.ts`, `diagnosis-result/page.tsx`.

### 6. ❌ Timer/resurs sızması
- **Eski:** progress `setInterval` xato holatida tozalanmasdi.
- **Yangi:** `useEffect` cleanup barcha timerlarni tozalaydi; `cancelled` guard.
- Fayl: `diagnosis-result/page.tsx`.

### 7. ⚠️ EEG grafigi tartibsiz + status-filtr no-op
- **Eski:** `random.sample` tartibsiz "to'lqin"; status-filtr har doim fallback.
- **Yangi:** `select_eeg_window` — uzluksiz, vaqt-tartibli, deterministik bo'lak. (Ma'lumotnoma cheklovi pastda.)
- Fayl: `services.py`.

### 8. ⚠️ Klient-server tip nomuvofiqligi
- **Yangi:** `age` va `sleep_hours_per_day` zod'da `.int()` — backend `PositiveIntegerField` bilan mos.
- Fayl: `OnboardingForm.tsx`.

## Tasdiqlash (verifikatsiya)

- ✅ Backend: **32 test** o'tadi (`python manage.py test patients`). Qarang: [[Backend Testing]].
- ✅ Frontend: `tsc --noEmit` toza.
- ✅ Migratsiya drifti yo'q (`makemigrations --check` → "No changes detected").
- 🔬 Mustaqil **adversarial audit** (33 agentli ko'p-agentli workflow) 19/27 topilmani tasdiqladi va manba-darajadagi tuzatishlarni to'g'ri deb baholadi.

## ⚠️ Deploy paytida bitta majburiy qadam

> [!danger] Migration 0005 jonli bazaga qo'llanilishi SHART
> Butun idempotentlik dizayni `OneToOneField` UNIQUE chekloviga tayanadi. Agar `0005` PostgreSQL'ga qo'llanmagan bo'lsa, cheklov yo'q va poygada dublikat qaytadi.
> ```bash
> cd backend
> python manage.py showmigrations patients   # 0005 → [X]
> python manage.py migrate patients           # kerak bo'lsa qo'llang
> ```
> `0005` avval eski dublikatlarni tozalaydi (`dedupe_reports`), keyin UNIQUE qo'shadi — to'ldirilgan bazada xavfsiz.

## Kelajakdagi qattiqlashtirish (ixtiyoriy, saqlashga ta'sir qilmaydi)

> [!note] Auth-refresh polishi (kod hali faol ishlanmoqda — ehtiyotkorlik bilan)
> - `OnboardingForm`: `update()` natijasini ishlatib tokenni aniq sarlavhada yuborish; interceptor uni qoplamasligi (`if (!config.headers.Authorization)`).
> - Token yo'q bo'lsa katta multipart yuklamadan oldin tez rad etish.
> - `refreshAuthSession` sessiyani qaytarib "no-op" holatini aniqlash.

> [!note] EEG ma'lumotnomasi
> `data/eeg_samples.json` faqat `status == 1` yozuvlarini saqlaydi. Vizualizatsiyaning "94% aniqlik bilan solishtirildi" matni illyustrativ — to'g'ri bo'lishi uchun 0/1/2 statusli ma'lumotlar qo'shilishi yoki matn yangilanishi kerak. Faqat ko'rinishga ta'sir qiladi.

Bog'liq: [[Diagnosis Service]], [[Data Models]], [[API Endpoints]], [[Assessment Save Flow]].
