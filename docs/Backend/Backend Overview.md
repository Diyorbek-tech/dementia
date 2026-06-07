---
tags: [backend, architecture]
created: 2026-06-05
up: "[[Home]]"
---

# Backend Overview

Django loyihasi `backend/` ichida. Asosiy biznes-mantiq `patients` ilovasida.

## Fayllar xaritasi

| Fayl | Vazifa | Yozuv |
|---|---|---|
| `patients/models.py` | `Patient`, `DiagnosisReport` modellari | [[Data Models]] |
| `patients/services.py` | `DiagnosisService` — skoring va tashxis | [[Diagnosis Service]] |
| `patients/views.py` | `PatientViewSet`, `diagnose_patient`, `GoogleLogin` | [[API Endpoints]] |
| `patients/serializers.py` | DRF serializerlar (nested report) | [[API Endpoints]] |
| `patients/urls.py` | URL marshrutlari | [[API Endpoints]] |
| `patients/tests.py` | Test to'plami (32 test) | [[Backend Testing]] |
| `patients/migrations/` | Schema migratsiyalari | [[Data Models]] |
| `patients/data/eeg_samples.json` | EEG vizualizatsiya namunalari | [[Diagnosis Service]] |
| `core/settings.py` | Django sozlamalari, JWT, LOGGING, test DB | [[Environment Variables]] |

## Asosiy qarorlar

> [!tip] Saqlash oqimining "pro" dizayni
> - So'rovnoma (`Patient`) va uning tashxisi (`DiagnosisReport`) **bitta tranzaksiyada** saqlanadi (`perform_create`).
> - Tashxis **deterministik** (tasodifiy emas) va **idempotent** (`OneToOneField` + `get_or_create`).
> - Endpointlar **user-scoped** — boshqa foydalanuvchi ma'lumotiga kirib bo'lmaydi.
> - Xatolar **logga yoziladi** (`LOGGING` konfiguratsiyasi) va toza `detail` xabar qaytaradi.

To'liq sabab-tahlil: [[Diagnosis Save Fix]]. Uchidan-uchiga oqim: [[Assessment Save Flow]].

## Ishga tushirish
```bash
cd backend
python manage.py migrate
python manage.py runserver 8000
```
Batafsil: [[Local Development]].
