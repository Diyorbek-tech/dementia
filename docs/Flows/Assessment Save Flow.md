---
tags: [flow, diagnosis, core]
created: 2026-06-05
up: "[[Home]]"
---

# Assessment Save Flow

Bu — tizimning **yuragi**: so'rovnomani topshirishdan tashxisni ko'rsatishgacha bo'lgan uchidan-uchiga oqim ("tashxis topshirish").

## Ketma-ketlik diagrammasi

```mermaid
sequenceDiagram
    autonumber
    participant U as Foydalanuvchi
    participant OF as OnboardingForm
    participant API as Django API
    participant DB as PostgreSQL
    participant RP as Result Page

    U->>OF: 7 bosqichni to'ldiradi, "Yuborish"
    OF->>OF: await update() (sessiyani yangilash)
    OF->>API: POST /patients/ (FormData)
    API->>DB: transaction.atomic:
    Note over API,DB: Patient saqlanadi + DiagnosisReport yaratiladi (deterministik)
    DB-->>API: Patient + diagnosis_report
    API-->>OF: 201 { id, diagnosis_report }
    OF->>RP: router.push(/diagnosis-result?id=<id>)
    RP->>RP: useEffect (startedRef guard)
    RP->>API: POST /diagnose/ { patient: id }
    API->>DB: get_diagnosis(patient) → mavjud hisobot
    DB-->>API: DiagnosisReport (o'sha)
    API-->>RP: 200 report
    RP->>U: Xavf %, EEG grafigi, tavsiyalar
```

## Kalit nuqtalar

> [!important] Bitta haqiqat manbai
> Tashxis hisoboti so'rovnoma **saqlanganda** (3-qadam) yaratiladi, natija sahifasida emas. Natija sahifasi faqat **o'qiydi**. Shu sabab:
> - Refresh natijani o'zgartirmaydi (deterministik).
> - StrictMode/refresh/retry dublikat yaratmaydi (idempotent + UNIQUE).
> - Saqlangan baholash har doim aniq bitta hisobotga ega (atomik).

## Buzilish nuqtalari va himoyalar
| Xavf | Himoya |
|---|---|
| Ikki marta POST (StrictMode) | `startedRef` guard + backend idempotent |
| Poygada ikki insert | OneToOne UNIQUE + `get_or_create` + `IntegrityError` ushlash |
| Noto'g'ri baholash ochilishi | `?id=` aniq uzatiladi |
| Yarim saqlash (patient bor, report yo'q) | `transaction.atomic` rollback |
| Tushunarsiz xato ekrani | `formatApiError` + `errorMsg` ko'rsatish |
| Server xatosi ko'rinmasligi | `LOGGING` + `logger.exception` |

Sabab-tahlil: [[Diagnosis Save Fix]]. Modellar: [[Data Models]]. Servis: [[Diagnosis Service]].
