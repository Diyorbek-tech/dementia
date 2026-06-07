---
tags: [backend, api, reference]
created: 2026-06-05
up: "[[Backend Overview]]"
---

# API Endpoints

Manba: `backend/patients/urls.py`, `views.py`, `serializers.py`. Hammasi `/api/` prefiksi ostida.

## Autentifikatsiya
- `POST /api/auth/google/` — Google access tokenni Django JWT'ga almashtiradi (`GoogleLogin`, `AllowAny`).
- `POST /api/auth/jwt/refresh/` — JWT access tokenni yangilaydi (`TokenRefreshView`).

So'rovlar `Authorization: Bearer <access>` sarlavhasi bilan autentifikatsiya qilinadi (SimpleJWT). Qarang: [[Auth and Session]].

## `POST /api/patients/` — so'rovnomani saqlash
`IsAuthenticated`. Multipart yoki JSON. So'rovnomani saqlaydi **va** tashxis hisobotini atomik yaratadi.

**Javob (201):** `Patient` + nested `diagnosis_report`:
```json
{
  "id": 42,
  "age": 68,
  "...": "...",
  "diagnosis_report": {
    "id": 7, "patient": 42,
    "risk_percentage": 52, "predicted_status": "MCI (Mild Cognitive Impairment)",
    "eeg_data_json": [ ... ], "recommendations": "..."
  }
}
```
- `perform_create` → `transaction.atomic` ichida `serializer.save(user=request.user)` + `DiagnosisService.get_diagnosis(patient)`.
- Validatsiya xatosi → **400**, maydon-kalitli (masalan `{"age": ["This field is required."]}`). Frontend buni o'qiydi: [[Auth and Session|formatApiError]].

## `GET /api/patients/` — tarix
`IsAuthenticated`. Faqat **joriy foydalanuvchi** baholashlari, eng yangisi birinchi. [[Diagnosis Result Page|Profil sahifasi]] grafigi shundan.

## `POST /api/diagnose/` — tashxisni olish (idempotent)
`IsAuthenticated`.

| Body | Xulq |
|---|---|
| `{ "patient": 42 }` | Aynan shu baholashning hisobotini qaytaradi (user-scoped) |
| `{}` (bo'sh) | Foydalanuvchining **eng oxirgi** baholashi |

**Javoblar:**
- **200** — `DiagnosisReportSerializer` ma'lumoti (mavjud bo'lsa qaytaradi, bo'lmasa yaratadi — idempotent).
- **404** `{"detail": "Tanlangan profil topilmadi."}` — id boshqa foydalanuvchiniki yoki yo'q.
- **404** `{"detail": "Profil topilmadi. Avval so'rovnomani to'ldiring."}` — hech qanday baholash yo'q.
- **500** `{"detail": "Tashxisni yaratishda xatolik..."}` — kutilmagan xato (logga yoziladi).

> [!note] Nega 200, 201 emas?
> `diagnose_patient` "get-or-create" — odatda allaqachon yaratilgan hisobotni qaytaradi (so'rovnoma saqlanganda yaratilgan). Shu sabab 200.

Bog'liq: [[Assessment Save Flow]], [[Diagnosis Service]].
