---
tags: [backend, testing]
created: 2026-06-05
up: "[[Backend Overview]]"
---

# Backend Testing

Manba: `backend/patients/tests.py`. **32 ta test**, hammasi o'tadi.

## Ishga tushirish
```bash
cd backend
python manage.py test patients              # barchasi
python manage.py test patients.tests.ComputeRiskTests -v 2   # bitta klass
```

> [!tip] Postgres shart emas
> `core/settings.py` `test` rejimini aniqlaydi va **xotiradagi SQLite**ga o'tadi:
> ```python
> if 'test' in sys.argv:
>     DATABASES['default'] = {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}
> ```
> Bu production/Docker'ga ta'sir qilmaydi (ular hech qachon `test` buyrug'i bilan ishlamaydi).

## Qamrov

| Test klassi | Nimani tekshiradi |
|---|---|
| `ComputeRiskTests` | Normal/MCI/AD chegaralari, **determinizm**, MMSE/MoCA ta'siri, `[2, 98]` clamp, `mmse==0` hisobga olinishi, `None` ballar |
| `EegWindowTests` | Bo'sh ma'lumot → `[]`, uzluksiz oyna, deterministik (seed), status fallback, oyna o'lchami |
| `DiagnosisReportModelTests` | OneToOne UNIQUE (`IntegrityError`), `__str__` |
| `GetDiagnosisTests` | Birinchi chaqiruvda yaratadi, **idempotentlik** (bitta yozuv), maydonlar to'ldirilishi |
| `PatientApiTests` | Auth talab (401/403), create → report, 400 validatsiya, user-scoping, diagnose idempotent + bir xil payload, aniq `patient` id, 404 holatlar, IDOR himoyasi, **atomik rollback** |

## Eng muhim testlar (saqlash uchun)

- `GetDiagnosisTests.test_is_idempotent` — ikki marta chaqiruv → bitta yozuv.
- `PatientApiTests.test_diagnose_is_idempotent` — ikki POST → bir xil `id`, `risk_percentage`, `eeg_data_json`.
- `PatientApiTests.test_save_is_atomic_when_diagnosis_fails` — tashxis yaratishda xato bo'lsa, `Patient` **saqlanmaydi** (rollback).
- `DiagnosisReportModelTests.test_one_report_per_patient_enforced` — DB UNIQUE cheklovi.
- `ComputeRiskTests.test_scoring_is_deterministic` — refresh natijani o'zgartirmaydi.

Bog'liq: [[Diagnosis Save Fix]].
