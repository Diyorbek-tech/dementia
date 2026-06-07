---
tags: [operations, reference, config]
created: 2026-06-05
up: "[[Home]]"
---

# Environment Variables

`.env` repo ildizida. Namuna: `.env.example`. Backend `python-decouple` orqali o'qiydi; frontend Next.js env orqali.

## Backend (Django)
| O'zgaruvchi | Vazifa |
|---|---|
| `SECRET_KEY` | Django maxfiy kaliti |
| `DEBUG` | `True`/`False` |
| `ALLOWED_HOSTS` | vergul bilan ajratilgan hostlar |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | DB hisob ma'lumotlari |
| `POSTGRES_HOST` / `POSTGRES_PORT` | DB manzili (Docker'da `db:5432`) |
| `CORS_ALLOWED_ORIGINS` | ruxsat etilgan frontend originlari |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth |

## Frontend (Next.js)
| O'zgaruvchi | Vazifa |
|---|---|
| `NEXT_PUBLIC_API_URL` | brauzerdan ko'rinadigan API (`/api`) |
| `BACKEND_INTERNAL_URL` | server-to-server backend manzili |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | NextAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth |

> [!note] Test rejimida
> Testlar `.env`dagi DB sozlamalarini chetlab o'tadi va xotiradagi SQLite ishlatadi (`'test' in sys.argv`). Qarang: [[Backend Testing]].

> [!warning] JWT mosligi
> `BACKEND_INTERNAL_URL` va `NEXT_PUBLIC_API_URL` bir xil backendga ishora qilishi kerak, aks holda JWT 401 nomuvofiqligi bo'ladi (`route.ts` buni ogohlantiradi).

Bog'liq: [[Auth and Session]], [[Deployment]].
