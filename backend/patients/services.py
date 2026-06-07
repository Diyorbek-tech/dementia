"""Async orchestration of the multimodal analysis.

``run_full_analysis`` runs each available modality sequentially in the Celery
worker, **persisting each result as it completes** (so the frontend's polling
shows progressive per-modality progress), then fuses them. A single
orchestrator (rather than a chord) keeps the DB writes race-free while giving
the same progressive UX. A failed modality is recorded and excluded from
fusion; the report ends ``done`` (all ok), ``partial`` (some failed) or
``failed`` (none succeeded).
"""
import logging

from .analysis import clinical, fusion
from .models import DiagnosisReport

logger = logging.getLogger("patients")


def create_pending_report(patient):
    """Idempotently create the (pending) report for an assessment."""
    report, _ = DiagnosisReport.objects.get_or_create(
        patient=patient,
        defaults={"analysis_status": DiagnosisReport.PENDING},
    )
    return report


def _has_file(field):
    return bool(field and getattr(field, "name", ""))


def _run_modality(report, result_field, errors, key, fn):
    """Run one modality, persist its result, return its risk (or None on failure)."""
    try:
        result = fn()
        setattr(report, result_field, result)
        report.save(update_fields=[result_field, "updated_at"])
        return result.get("risk")
    except Exception:
        logger.exception("%s analysis failed for report %s", key, report.pk)
        errors.append(key)
        setattr(report, result_field, {"error": "analysis_failed", "modality": key})
        report.save(update_fields=[result_field, "updated_at"])
        return None


def run_full_analysis(report_id):
    """Analyze every available modality for a report, then fuse. Returns the report."""
    report = DiagnosisReport.objects.select_related("patient").get(pk=report_id)
    patient = report.patient

    report.analysis_status = DiagnosisReport.PROCESSING
    report.save(update_fields=["analysis_status", "updated_at"])

    modality_risks = {}
    errors = []

    # ── Clinical (always available — pure questionnaire scorer) ────────────────
    try:
        clinical_result = clinical.score_clinical(patient)
        report.clinical_result = clinical_result
        report.save(update_fields=["clinical_result", "updated_at"])
        modality_risks["clinical"] = clinical_result["risk"]
    except Exception:
        logger.exception("Clinical analysis failed for report %s", report.pk)
        errors.append("clinical")

    # ── EEG ────────────────────────────────────────────────────────────────────
    if _has_file(patient.eeg_file):
        def _eeg():
            from .analysis import eeg
            return eeg.analyze_eeg(patient.eeg_file.path)
        modality_risks["eeg"] = _run_modality(report, "eeg_result", errors, "eeg", _eeg)

    # ── Speech ───────────────────────────────────────────────────────────────
    if _has_file(patient.voice_recording):
        def _speech():
            from .analysis import speech
            return speech.analyze_speech(patient.voice_recording.path)
        modality_risks["speech"] = _run_modality(report, "speech_result", errors, "speech", _speech)

    # ── Face ─────────────────────────────────────────────────────────────────
    if _has_file(patient.face_video):
        def _face():
            from .analysis import face
            return face.analyze_face(patient.face_video.path)
        modality_risks["face"] = _run_modality(report, "face_result", errors, "face", _face)

    # ── Fusion ─────────────────────────────────────────────────────────────────
    usable = {k: v for k, v in modality_risks.items() if v is not None}
    fused = fusion.fuse(usable)
    report.fusion_result = fused
    report.risk_percentage = fused["overall_risk"]
    report.predicted_status = fused["predicted_status"]
    report.recommendations = fused["recommendations"]
    report.confidence = fused["confidence"]
    report.modalities_used = fused["modalities_used"]

    if not usable:
        report.analysis_status = DiagnosisReport.FAILED
    elif errors:
        report.analysis_status = DiagnosisReport.PARTIAL
    else:
        report.analysis_status = DiagnosisReport.DONE
    report.save()

    logger.info("Report %s analysis complete: status=%s modalities=%s",
                report.pk, report.analysis_status, report.modalities_used)
    return report
