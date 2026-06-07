---
tags: [operations, setup]
created: 2026-06-05
up: "[[Home]]"
---

# Local Development

## Backend
```bash
cd backend
# .env repo ildizida bo'lishi kerak (python-decouple uni topadi)
python manage.py migrate
python manage.py runserver 8000
```
API: `http://localhost:8000/api/`.

> [!warning] venv haqida
> Repodagi `backend/venv` boshqa mashinada (Python 3.14) yaratilgan va bu mashinada **buzilgan**. Kerakli paketlar tizim Python 3.13'da mavjud. Toza venv uchun:
> ```bash
> python -m venv .venv
> .venv\Scripts\activate          # Windows
> pip install -r requirements.txt
> ```

## Frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
npx tsc --noEmit     # tip tekshiruvi
```

## Testlar
```bash
cd backend
python manage.py test patients      # 32 test, SQLite (Postgres shart emas)
```
Qarang: [[Backend Testing]].

## Tezkor sog'liq tekshiruvi
```bash
python manage.py check                          # konfiguratsiya
python manage.py makemigrations --check --dry-run   # model drifti yo'qligi
```

Bog'liq: [[Environment Variables]], [[Deployment]].
