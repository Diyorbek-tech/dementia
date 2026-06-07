---
tags: [architecture, reference]
created: 2026-06-05
up: "[[Architecture Overview]]"
---

# Tech Stack

## Backend
| Qatlam | Texnologiya | Izoh |
|---|---|---|
| Til | Python 3.13 | |
| Framework | Django 5.x | `backend/core` |
| API | Django REST Framework | ViewSet + `@api_view` |
| Auth | `dj-rest-auth` + `allauth` (Google) + `djangorestframework-simplejwt` | JWT Bearer |
| DB (prod) | PostgreSQL 16 | `docker-compose.yml` |
| DB (test) | SQLite (in-memory) | `core/settings.py` da `test` rejimida |
| Static | WhiteNoise | |
| Server | Gunicorn | `entrypoint.sh` |
| Config | `python-decouple` | `.env` dan o'qiydi |

## Frontend
| Qatlam | Texnologiya | Izoh |
|---|---|---|
| Framework | Next.js (App Router) | `frontend/src/app` |
| Til | TypeScript | |
| Auth | NextAuth.js (Google provider) | `app/api/auth/[...nextauth]` |
| Forms | React Hook Form + Zod | `OnboardingForm.tsx` |
| HTTP | Axios | `lib/api.ts` |
| i18n | `next-intl` | `uz` (default), `en`, `ru` |
| UI | Tailwind CSS + lucide-react + recharts | |

## Infratuzilma
- **Nginx** — reverse proxy (`:80` → frontend `:3000` va backend `:8000`).
- **Docker Compose** — `db`, `backend`, `frontend`, `nginx` xizmatlari.

Bog'liq: [[Backend Overview]], [[Frontend Overview]], [[Deployment]], [[Environment Variables]].
