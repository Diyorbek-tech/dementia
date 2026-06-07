"""Celery application for the dementia backend.

Heavy multimodal analysis (Whisper transcription, EEG modelling, face-video
processing) runs in a separate Celery worker so the API request that creates an
assessment returns immediately. The broker and result backend are Redis.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

app = Celery("core")

# All CELERY_* settings live in Django settings.py.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Discover tasks.py in every installed app (e.g. patients/tasks.py).
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):  # pragma: no cover - smoke helper
    print(f"Request: {self.request!r}")
