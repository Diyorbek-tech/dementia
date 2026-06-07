---
tags: [frontend, forms, diagnosis]
created: 2026-06-05
up: "[[Frontend Overview]]"
---

# Onboarding Form

Manba: `frontend/src/components/OnboardingForm.tsx`. 7 bosqichli sehrgardek (wizard) so'rovnoma. React Hook Form + Zod validatsiyasi.

## Bosqichlar
| # | Sarlavha | Maydonlar |
|---|---|---|
| 1 | Shaxsiy ma'lumotlar | `age`, `gender`, `education_level` |
| 2 | Tibbiy tarix | 6 ta boolean |
| 3 | Kognitiv belgilar | 4 ta boolean |
| 4 | Turmush tarzi | `smoking_status`, `sleep_hours_per_day`, `physical_activity` |
| 5 | Ovoz testi | `voice_recording` (ixtiyoriy) |
| 6 | Yuz testi | `face_video` (ixtiyoriy) |
| 7 | Tibbiy tasvirlar + ballar | `eeg_file`, `mri_file`, `mmse_score`, `moca_score` (ixtiyoriy) |

## Zod sxemasi — backend bilan moslik
> [!note] Butun sonlar
> `age` va `sleep_hours_per_day` backendda `PositiveIntegerField`. Shu sabab zod'da `z.number().int()` — `7.5` kabi qiymat **klient tomonida** rad etiladi (katta multipart yuklamadan oldin), bekorga server 400 qaytarmaydi.

## Submit (`onSubmit`)
```ts
await update()                                  // NextAuth sessiyasini yangilaydi
const fd = new FormData()                        // maydonlar + media bloblar
const res = await api.post("/patients/", fd)     // saqlaydi + tashxis yaratadi (atomik)
const patientId = res?.data?.id
router.push(`/${locale}/diagnosis-result?id=${patientId}`)   // id'ni uzatadi
```

> [!important] Nega `?id=` uzatiladi?
> Natija sahifasi "eng oxirgi" baholashni taxmin qilmasligi uchun. Yangi saqlangan baholashning aniq `id`'si uzatiladi → [[Diagnosis Result Page]] aynan shu hisobotni o'qiydi. (Eski xulq poyga sharoitida noto'g'ri baholashni ochishi mumkin edi.)

## Xatolarni ko'rsatish
`catch` bloki `formatApiError(error)` (markazlashtirilgan, `lib/api.ts`'da) chaqiradi — DRF maydon-xatolari, `detail`, 401/404/network hammasi o'zbekcha xabarga aylanadi. Backend auth xatosi bo'lsa, login sahifasiga yo'naltiradi. Qarang: [[Auth and Session]].

## Media yozish
`MediaRecorder` API orqali ovoz (`audio/webm`) va yuz (`video/webm`) yoziladi; `useRef` bilan stream/timer tozalanadi (unmount'da). Bu qism saqlash muammosiga aloqador emas, lekin xotira sızmasligi uchun cleanup muhim.

Bog'liq: [[Assessment Save Flow]], [[API Endpoints]].
