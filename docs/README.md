# 📓 Dementia — Obsidian Developer Vault

Bu `docs/` katalogi — **Obsidian vault** (loyihaning to'liq texnik hujjati).

## Qanday ochish
1. [Obsidian](https://obsidian.md) ni o'rnating.
2. **Open folder as vault** → shu `docs/` katalogini tanlang.
3. **[[Home]]** yozuvidan boshlang — bu Map of Content (indeks).
4. **Graph View** (`Ctrl/Cmd + G`) — yozuvlar orasidagi bog'lanishlarni ko'ring.

## Obsidian tamoyillari (shu vault'da qo'llangan)
- **Atomik yozuvlar** — har fayl bitta mavzu.
- **`[[Wikilinks]]`** — yozuvlar o'zaro bog'langan.
- **YAML frontmatter** — `tags`, `aliases`, `up` (ota-yozuv).
- **MOC** ([[Home]]) — markaziy indeks.
- **Callouts** (`> [!note]`, `> [!warning]`, `> [!danger]`) va **Mermaid** diagrammalari.

## Struktura
```
docs/
├── Home.md                  ← shu yerdan boshlang (MOC)
├── Architecture/            arxitektura va texnologiyalar
├── Backend/                 Django: modellar, servis, API, testlar
├── Frontend/                Next.js: forma, natija sahifasi, auth
├── Flows/                   uchidan-uchiga oqimlar
├── Fixes/                   ⭐ Diagnosis Save Fix (asosiy)
├── Operations/              setup, deploy, env
└── Reference/               lug'at
```

> [!tip] Boshlash uchun
> Saqlash muammosini tushunish uchun: **[[Diagnosis Save Fix]]** → **[[Assessment Save Flow]]**.
