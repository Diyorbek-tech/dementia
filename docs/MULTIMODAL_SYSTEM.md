# Multimodal Cognitive-Decline Detection & Remote Monitoring

**Dissertation:** *Multimodal Data Acquisition, Fusion and Machine Learning for Early Detection and Remote Monitoring of Cognitive Decline Biomarkers in Dementia.*

This document maps the implemented system onto the dissertation's pillars and records the methodology, models, validation, and limitations.

---

## 1. Architecture

```
Browser (Next.js, English-first)
  → nginx :80
     ├─ /            → Next.js (acquisition UI, result & monitoring dashboards)
     ├─ /api/auth/   → NextAuth (Google → backend JWT exchange)
     └─ /api/        → Django REST (orchestration)
Django ──enqueue──▶ Redis ──▶ Celery worker (multimodal analysis)
Shared media volume (uploads readable by API + worker)
Postgres (assessments + per-modality results + fused outcome)
Baked ML artifacts: trained EEG model (joblib), Whisper, MediaPipe, spaCy
```

**Async flow:** `POST /api/patients/` saves the assessment + a `pending` report and enqueues `run_full_analysis`. The worker analyzes each available modality, **persisting results progressively**, then fuses them. The frontend polls `GET /api/patients/{id}/report/` and renders live per-modality progress, then the full dashboard.

---

## 2. Pillar → component mapping

| Dissertation pillar | Implementation |
|---|---|
| **Data acquisition** | 7-step onboarding: questionnaire, **English speech** recording, **face video**, **EEG upload** (CSV/EDF), MMSE/MoCA. `OnboardingForm.tsx`. |
| **Machine learning** | EEG: RandomForest trained on band-power features (`train_eeg_model`). Speech/Face: literature-grounded feature extractors → calibrated scores. |
| **Fusion** | Explainable weighted late fusion with missing-modality renormalization + per-modality contributions + confidence (`analysis/fusion.py`). |
| **Early detection** | 3-class outcome (Normal / MCI / AD) with probabilities and biomarker breakdown. |
| **Remote monitoring** | Longitudinal risk-trajectory dashboard + decline-detection banner + per-visit history (`profile/page.tsx`). |

---

## 3. Per-modality methodology

### 3.1 EEG (`analysis/eeg.py`, `train_eeg_model.py`)
- **Dataset:** Kaggle `ucimachinelearning/eeg-alzheimers-dataset` (OpenNeuro **ds004504**, Miltiadous et al. 2023): 19 channels, 256 Hz, classes AD/FTD/HC.
- **Features (per 1-s window, aggregated):** relative band powers (δ 0.5–4, θ 4–8, α 8–13, β 13–30, γ 30–45 Hz) via Welch PSD; **slowing ratios** θ/α, θ/β, (δ+θ)/(α+β); spectral entropy; Hjorth mobility/complexity; regional α/θ (frontal/temporal/parietal/occipital). Channel-count agnostic.
- **Model:** `RandomForestClassifier` (balanced), stratified-CV reported at train time.
- **Bootstrap vs real:** the image bakes a model trained on a band-power-faithful **synthetic** multi-class set so the demo runs out-of-the-box. Run `import_kaggle_eeg` (Kaggle creds) then `train_eeg_model` to fit on the **real** dataset for the dissertation.
- **Output:** class probabilities, relative band powers, slowing ratios, interpretable biomarkers, and a **real waveform preview** of the uploaded signal.

### 3.2 Speech (`analysis/speech.py`)
- **Acoustic** (librosa + Praat/parselmouth): pause count/ratio, speech & articulation rate, F0 mean/SD, jitter, shimmer, MFCC summary.
- **Transcription:** faster-whisper `base.en` (CPU; English required).
- **Linguistic** (spaCy `en_core_web_sm` + textstat): type-token ratio (lexical diversity), words/min, mean sentence length, filler ratio, syntactic depth.
- **Scoring:** literature-grounded directions (↑pauses, ↓fluency, ↓lexical diversity, ↓syntactic complexity ⇒ ↑risk). **Feature-based** (not yet trained on labeled clinical speech); upgrade path = **ADReSS / DementiaBank**.

### 3.3 Face (`analysis/face.py`)
- **MediaPipe FaceMesh** (bundled) + OpenCV frame sampling (~5 fps).
- **Biomarkers:** facial **expressivity** (temporal variance of expression metrics — low = hypomimia), **blink rate** (eye-aspect-ratio), head movement, detection rate.
- **Scoring:** reduced expressivity / abnormal blink ⇒ ↑risk. Feature-based.

### 3.4 Clinical (`analysis/clinical.py`)
- Deterministic rule-based scorer over questionnaire + MMSE/MoCA, returning the contributing factors.

---

## 4. Fusion (`analysis/fusion.py`)

Each modality emits a calibrated risk ∈ [0,100]. Default weights (speech 0.35, EEG 0.30, clinical 0.25, face 0.10) are **renormalized over the present modalities**, so a missing/failed modality never zeroes the result:

```
overall = Σ_m (w_m / Σ w_present) · risk_m
status  = AD (>70) | MCI (35–70) | Normal (<35)
confidence = 100·(0.6·coverage + 0.4·agreement)   # coverage=#modalities/4, agreement=1−spread/50
```

Per-modality **contributions** (weight × risk) drive the explainability bar chart.

---

## 5. Validation

- Backend: `python manage.py test patients` (22 tests) — clinical scorer, fusion (renormalization/thresholds/confidence), speech/face scoring monotonicity, EEG feature directions (alpha-dominant Normal vs slowing AD), trained-model inference, async API (create→fuse→done), polling, ownership, sample download.
- EEG model CV metrics are printed by `train_eeg_model` (perfect on the separable synthetic bootstrap; realistic on the real dataset).

---

## 6. Acquisition & test data

- Users upload an EEG CSV (channel columns @ 256 Hz). **Sample files** are available from the UI (`GET /api/eeg/sample/?cls=normal|mci|ad`) and via `python manage.py make_test_eeg`.
- Speech must be **English** (Whisper `base.en` + English linguistic features). The onboarding shows a fixed English reading passage.

---

## 7. Limitations & ethics

- **Screening, not diagnosis.** Surfaced in the UI and reports.
- Speech/face are **feature-based** demonstrators pending labeled-data training; EEG is trained but on a synthetic bootstrap unless the real dataset is imported.
- **MRI is not a remote modality** (requires a scanner) and is de-scoped from active analysis (upload retained, stored only).
- Sensitive **biometric + health** data (voice, face, EEG): consent, encryption, and access control are required for any real deployment. Validate fairness across age, language, education, and gender.

---

## 8. Running / retraining

```bash
docker compose up -d --build         # full stack (db, redis, backend, worker, nginx)
docker compose exec backend python manage.py test patients
# real EEG model for the dissertation:
docker compose exec backend python manage.py import_kaggle_eeg   # needs Kaggle creds
docker compose exec backend python manage.py train_eeg_model
```
