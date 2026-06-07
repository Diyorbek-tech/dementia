"""Celery tasks for the patients app.

The heavy modality analysis runs here, off the request thread. Autodiscovered
by the Celery app (see core/celery.py).
"""
import logging

from celery import shared_task

from . import services

logger = logging.getLogger("patients")


@shared_task(name="patients.run_full_analysis", bind=True, max_retries=2, default_retry_delay=5)
def run_full_analysis(self, report_id):
    """Analyze all modalities for a report and fuse them. Returns the final status."""
    try:
        report = services.run_full_analysis(report_id)
        return {"report_id": report_id, "status": report.analysis_status}
    except Exception as exc:  # pragma: no cover - infra failure path
        logger.exception("run_full_analysis crashed for report %s", report_id)
        raise self.retry(exc=exc)
