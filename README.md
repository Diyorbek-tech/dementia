# Dementia Early Detection Platform

A comprehensive Patient Registration and Medical Profiling system tailored for health-tech scenarios, specializing in early detection markers.

## Architecture & Tech Stack
- **Backend**: Django, Django REST Framework (DRF), SQLite (default)
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, React Hook Form, Zod, Axios

## Setup Instructions

### 1. Backend Setup
Navigate to the backend directory and setup the environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install django djangorestframework django-cors-headers
python manage.py migrate
python manage.py runserver 8000
```
The API serves at `http://localhost:8000/api/patients/`.

### 2. Frontend Setup
Navigate to the frontend directory and run the Next.js app:
```bash
cd frontend
# Dependencies are managed with npm
npm install
npm run dev
```
The user interface is available at `http://localhost:3000`.

## Features
- **Multi-step Onboarding**: Streamlined collection of basic info, medical history, and clinical scores.
- **Robust Validation**: `zod` schema parsing on the frontend + DRF serializers on the backend.
- **Accessible UI**: Large inputs, high-contrast text, clear error states, and intuitive navigation.
