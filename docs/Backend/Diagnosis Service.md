---
tags: [backend, diagnosis, core]
created: 2026-06-05
up: "[[Backend Overview]]"
---

# Diagnosis Service

Manba: `backend/patients/services.py`. `DiagnosisService` — tashxis hisobotini yaratuvchi yagona joy.

## Uchta kafolat

> [!important] Pro xususiyatlar
> 1. **Deterministik** — `compute_risk()` sof funksiya, tasodif yo'q. Bir xil kirish → bir xil natija. (Eski kodda `random.randint(-5, 5)` bor edi → refresh natijani o'zgartirardi.)
> 2. **Idempotent** — `get_diagnosis()` ni necha marta chaqirsangiz ham, bitta hisobot qaytadi (dublikat yaratmaydi).
> 3. **Atomik** — `@transaction.atomic` bilan o'ralgan.

## `compute_risk(patient) -> (risk, status, code)`

Sof skoring funksiyasi. Ball quyidagilardan yig'iladi:
- **Yosh:** >75 → +40, >65 → +20, >55 → +10
- **Tibbiy tarix:** gipertenziya/diabet +12, insult +18, oilaviy Alzheimer +22, depressiya +8, alkogol +6
- **Kognitiv belgilar:** xotira +10, nutq +8, yo'nalish +10, kayfiyat +6
- **Turmush tarzi:** chekish (Current) +6, faollik yo'q +5, uyqu <5 yoki >10 soat +4
- **Klinik ballar (past = yomon):** MMSE <20 → +40, <24 → +20, <27 → +8; MoCA <18 → +30, <26 → +12

```python
risk_percentage = max(2, min(score, 98))   # [2, 98] oralig'ida
```

Status chegaralari: `> 70` → **AD**, `> 35` → **MCI**, aks holda **Normal**.

> [!note] `is not None` muhim
> Klinik ballar `if patient.mmse_score is not None:` orqali tekshiriladi — `mmse_score == 0` (eng yomon holat) `if patient.mmse_score:` truthiness'ida noto'g'ri o'tkazib yuborilardi. Test: `test_mmse_zero_is_counted_not_skipped`.

## `get_diagnosis(patient)` — idempotent kirish nuqtasi

```python
@transaction.atomic
def get_diagnosis(patient):
    existing = DiagnosisReport.objects.filter(patient=patient).first()
    if existing is not None:
        return existing                      # tezkor yo'l
    ...
    try:
        report, _ = DiagnosisReport.objects.get_or_create(patient=patient, defaults={...})
    except IntegrityError:
        report = DiagnosisReport.objects.get(patient=patient)   # poygada yutqazgan so'rov
    return report
```

OneToOne UNIQUE cheklovi + `get_or_create` + `IntegrityError` ushlash = bir vaqtning o'zida ikki so'rov kelsa ham bitta hisobot. Qarang: [[Data Models]].

## EEG namunasini tanlash — `select_eeg_window(samples, code, seed)`

To'lqin grafigi uchun **uzluksiz** (contiguous), vaqt bo'yicha tartiblangan EEG bo'lagi tanlanadi (eski kodda `random.sample` — tartibsiz, tishli grafik berardi). Boshlang'ich nuqta `seed=patient.pk` dan deterministik tanlanadi.

> [!warning] Ma'lumotnoma cheklovi
> `data/eeg_samples.json` da hozir faqat `status == 1` (MCI) yozuvlari bor (2000 ta). Shu sababli Normal/AD bashoratlari uchun status-filtr mos kelmaydi va to'liq to'plamga "fallback" qiladi. Bu **faqat vizualizatsiyaga** ta'sir qiladi — xavf foizi va saqlashga emas. Kelajakda 0/2 statusli ma'lumotlar qo'shilsa, grafik to'g'riroq bo'ladi. Qarang: [[Diagnosis Save Fix]] "Kelajakdagi qattiqlashtirish".

## Testlar
`ComputeRiskTests`, `EegWindowTests`, `GetDiagnosisTests` — [[Backend Testing]].
