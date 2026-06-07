# ─── Dementia backend (Django + Celery + multimodal ML) ──────────────────────
# Single stage: the ML stack (mediapipe/opencv/librosa/scikit-learn/faster-whisper)
# ships large binary wheels, so the multi-stage wheel split saved little while
# adding fragility. We install directly and bake the trained EEG model in.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.cache/huggingface \
    NUMBA_CACHE_DIR=/app/.cache/numba \
    MPLCONFIGDIR=/app/.cache/mpl

# System libraries:
#  build-essential, libpq-dev  → build psycopg2 and any source deps
#  ffmpeg, libsndfile1         → audio/video decoding (faster-whisper, librosa, opencv)
#  libgl1, libglib2.0-0        → runtime shared libs for opencv / mediapipe
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    ffmpeg \
    libsndfile1 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# spaCy English model for syntactic features. Non-fatal: the speech module
# degrades to textstat + heuristics if the model is unavailable.
RUN python -m spacy download en_core_web_sm || echo "WARN: spaCy model download skipped"

RUN addgroup --system django && adduser --system --ingroup django django

COPY . .

# Train the EEG classifier at build so the model is baked into the image.
# Dummy secrets only satisfy settings import; runtime env_file overrides them.
# Falls back to synthetic multi-class data if the dataset is absent.
RUN SECRET_KEY=build-dummy GOOGLE_CLIENT_ID=build GOOGLE_CLIENT_SECRET=build DEBUG=True \
    python manage.py train_eeg_model || echo "WARN: EEG model training skipped at build"

RUN mkdir -p /app/staticfiles /app/media /app/.cache \
    && chown -R django:django /app

RUN chmod +x /app/entrypoint.sh

USER django

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
