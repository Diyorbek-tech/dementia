---
tags: [backend, models, database]
created: 2026-06-05
up: "[[Backend Overview]]"
---

# Data Models

Manba: `backend/patients/models.py`.

## `Patient` — bitta baholash (assessment)

Har bir to'ldirilgan so'rovnoma alohida `Patient` yozuvi sifatida saqlanadi (tarix uchun). `user` (FK) orqali Django foydalanuvchisiga bog'langan.

Maydon guruhlari:
- **Demografik:** `age`, `gender`, `education_level`
- **Klinik ballar:** `mmse_score`, `moca_score` (0–30, ixtiyoriy)
- **Tibbiy tarix:** `hypertension`, `diabetes`, `history_of_stroke`, `depression`, `family_history_of_alzheimers`, `alcohol_use`
- **Kognitiv belgilar:** `memory_complaints`, `language_difficulties`, `orientation_problems`, `mood_behavioral_changes`
- **Turmush tarzi:** `smoking_status`, `sleep_hours_per_day`, `physical_activity`
- **Media fayllar:** `voice_recording`, `face_video`, `eeg_file`, `mri_file` (ixtiyoriy)
- `created_at` — avtomatik

```python
class Meta:
    ordering = ['-created_at']   # eng yangisi birinchi
```

## `DiagnosisReport` — bitta baholashga bitta tashxis

> [!important] OneToOne munosabati
> `patient = models.OneToOneField(Patient, related_name='diagnosis_report')`.
> Bu **DB darajasida UNIQUE** cheklov beradi — bitta baholashda **ko'pi bilan bitta** hisobot bo'ladi. Aynan shu cheklov [[Diagnosis Service|idempotentlikni]] poyga sharoitida ham kafolatlaydi.

Maydonlar:
- `risk_percentage` — `FloatField`, validatorlar `[0, 100]`
- `predicted_status` — `Normal` | `MCI (...)` | `AD (...)` (model konstantalari: `DiagnosisReport.NORMAL/MCI/AD`)
- `eeg_data_json` — `JSONField(default=list)` — to'lqin grafigi uchun EEG namunasi
- `recommendations` — matn (o'zbekcha tavsiya)
- `created_at`

## Migratsiyalar

| Migratsiya | Mazmun |
|---|---|
| `0001`–`0002` | Boshlang'ich `Patient` |
| `0003` | `DiagnosisReport` (dastlab FK) |
| `0004` | Yangi `Patient` maydonlari |
| **`0005`** | ⭐ FK → **OneToOne**, dublikatlarni tozalash (`dedupe_reports`), validatorlar, `Meta.ordering` |

> [!warning] Deploy paytida muhim
> `0005` jonli PostgreSQL'ga **qo'llanilishi shart**. Aks holda UNIQUE cheklov yo'q bo'ladi va idempotentlik faqat ilova darajasida qoladi (poyga sharoitida dublikat xavfi). Tekshirish:
> ```bash
> python manage.py showmigrations patients   # 0005 → [X] bo'lsin
> python manage.py migrate patients
> ```
> `0005` avval eski dublikatlarni (har bemorda eng yangisini qoldirib) tozalaydi, keyin UNIQUE qo'shadi — to'ldirilgan bazada ham xavfsiz.

Bog'liq: [[Diagnosis Save Fix]], [[Diagnosis Service]].
