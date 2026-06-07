---
aliases: [Home, Index, MOC, Bosh sahifa]
tags: [moc, dementia, index]
created: 2026-06-05
---

# 🧠 Dementia Early Detection — Developer Vault

> [!info] Bu nima?
> Bu **Obsidian vault** — Dementia Early Detection platformasining to'liq texnik hujjati.
> Har bir yozuv (note) atomik: bitta mavzu, bitta fayl. Yozuvlar `[[wikilink]]` orqali bog'langan.
> Grafik ko'rinishni ochish uchun Obsidian'da **Graph View** (`Ctrl/Cmd+G`) dan foydalaning.

Platforma — bemorlarni ro'yxatdan o'tkazish va kognitiv holatni (Alzheimer / MCI / Normal) erta aniqlash uchun **AI-simulyatsiyali** tibbiy profillash tizimi.

## 🗺️ Map of Content

### Arxitektura
- [[Architecture Overview]] — tizim umumiy ko'rinishi va diagramma
- [[Tech Stack]] — texnologiyalar to'plami

### Backend (Django + DRF)
- [[Backend Overview]] — backend tuzilmasi
- [[Data Models]] — `Patient` va `DiagnosisReport`
- [[Diagnosis Service]] — skoring, determinizm, idempotentlik
- [[API Endpoints]] — REST endpointlar
- [[Backend Testing]] — test to'plami va uni ishga tushirish

### Frontend (Next.js + TypeScript)
- [[Frontend Overview]] — frontend tuzilmasi
- [[Onboarding Form]] — 7 bosqichli so'rovnoma
- [[Diagnosis Result Page]] — natija sahifasi
- [[Auth and Session]] — NextAuth, Google OAuth, JWT

### Oqimlar (Flows)
- [[Assessment Save Flow]] — **asosiy oqim**: so'rovnomani saqlash → tashxis

### Tuzatishlar (Fixes)
- [[Diagnosis Save Fix]] — ⭐ "saqlash" muammosining sababi va pro yechimi
- [[Session 401 Loop Fix]] — ⭐ profil sahifasidagi cheksiz 401 sessiya sikli

### Operatsiyalar
- [[Local Development]] — lokal o'rnatish va ishga tushirish
- [[Deployment]] — Docker bilan deploy
- [[Environment Variables]] — `.env` o'zgaruvchilari

### Ma'lumotnoma
- [[Glossary]] — atamalar lug'ati

## 🔑 Eng muhim yozuv

> [!important] "Tashxis topshirishni oxirgi bosqichida saqlash"
> Agar siz shu loyihaga yangi qo'shilayotgan bo'lsangiz, **[[Diagnosis Save Fix]]** va
> **[[Assessment Save Flow]]** dan boshlang — bu tizimning yuragi.

## 🏷️ Teglar
`#backend` `#frontend` `#bugfix` `#testing` `#architecture` `#diagnosis`
