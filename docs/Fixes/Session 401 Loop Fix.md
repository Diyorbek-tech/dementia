---
tags: [bugfix, auth, security, postmortem]
created: 2026-06-05
up: "[[Home]]"
aliases: ["401 sikl", "Infinite 401 loop", "Profil sessiya muammosi"]
---

# Session 401 Loop Fix ⭐

> [!abstract] Muammo
> Profil sahifasiga (`/[locale]/profile`) kirilganda konsolda **minglab** `GET /api/patients/ 401 (Unauthorized)` xatosi paydo bo'lardi (cheksiz sikl) va "Sessiya yangilanmadi" banneri ko'rsatilardi.

## Asosiy sabab

Ikki sabab birlashgan edi:

**(A) `update()` effekt ichida → cheksiz re-render sikli.** Profil `useEffect(..., [status])` ichida `fetchAssessments` `await update()` chaqirardi. next-auth `update()` `status`ni `loading → authenticated` ga tebratadi → effekt **qayta** ishga tushadi → yana `update()` → ... cheksiz. Har siklda "Failed to fetch assessments" loglanardi (skrinshotda 1.8k xato).

**(B) Tokensiz so'rov.** NextAuth (Google) sessiyasi bor, lekin Django **backend access token** mintlanmagan (`backend_token_error`). Tokensiz `api.get("/patients/")` → **401** → yangilashga urinish (yana muvaffaqiyatsiz) → 401 shovqini.

## Yechim — "fail-fast"

> [!important] Asosiy g'oya
> Backend token yo'q bo'lsa, so'rovni **umuman yubormaslik**. 401 olib, keyin yangilashga urinish o'rniga — darhol toza `BackendAuthError` qaytarish.

### 1. `lib/api.ts` — request interceptor fail-fast
```ts
if (backendToken) {
  if (!config.headers.Authorization) config.headers.Authorization = `Bearer ${backendToken}`;
} else if (!config.headers.Authorization) {
  throw createBackendAuthError();   // tokensiz so'rov yuborilmaydi → 401 shovqini yo'q
}
```

### 2. `lib/api.ts` — response interceptor cheklangan retry
- `BackendAuthError`ni hech qachon qayta urinmaydi.
- 401 da **bir marta** yangilaydi; token chiqmasa → `reject(BackendAuthError)` (retry-storm yo'q).
- Yangilangan sessiyadan tokenni **to'g'ridan-to'g'ri** ishlatadi.

### 3. `lib/session-refresh.ts` — sessiyani qaytaradi
`refreshAuthSession()` endi `update()` natijasini qaytaradi → interceptor "no-op" yangilanishni aniqlaydi.

### 4. `profile/page.tsx` — `update()` olib tashlandi + bir martalik guard
```ts
const fetchedRef = useRef(false);
// useEffect ichida: if (fetchedRef.current) return; fetchedRef.current = true;
```
- **`await update()` hot-path'dan butunlay olib tashlandi** (sabab A ildizdan yo'qoldi). Token endi faqat 401 da reaktiv yangilanadi.
- `fetchedRef` guard — effekt necha marta qayta ishlasa ham, yuklash **bir marta**.
- Ichki ikki-marta urinish olib tashlandi; `BackendAuthError` → bitta toza xabar.

## Natija
- Tokensiz holatda **nol** tarmoq 401 so'rovi (oldin: minglab).
- Foydalanuvchi **bir marta** toza xabar ko'radi va login sahifasiga o'tishi mumkin.
- Bu himoya barcha `api.*` chaqiruvlariga taalluqli — [[Onboarding Form|so'rovnoma saqlash]]da ham katta multipart yuklamadan oldin tez rad etadi.

> [!note] Nega backend token yo'qoladi?
> Google sessiyasi bor, lekin backend JWT almashuvi/yangilashi muvaffaqiyatsiz (backend qayta ishga tushgan, `SECRET_KEY` o'zgargan, yoki Google refresh muddati tugagan). Bunday holatda yagona to'g'ri yo'l — qayta kirish. Token oqimi: [[Auth and Session]].

Bog'liq: [[Auth and Session]], [[Diagnosis Save Fix]].
