"""Clinical modality: questionnaire + MMSE/MoCA rule-based risk scorer.

Ported from the original ``DiagnosisService.compute_risk`` but returns the
contributing **factors** (for display) and English recommendations. Pure and
deterministic — no I/O, no heavy deps — so it is fast and easy to test.
"""
from __future__ import annotations

# Status labels (kept stable for the frontend & DiagnosisReport choices).
NORMAL = "Normal"
MCI = "MCI (Mild Cognitive Impairment)"
AD = "AD (Alzheimer's Disease)"


def _g(patient, name, default=None):
    if isinstance(patient, dict):
        return patient.get(name, default)
    return getattr(patient, name, default)


def score_clinical(patient):
    """Return {risk, predicted_status, status_code, factors[]} from questionnaire data."""
    score = 0
    factors = []

    def add(points, label):
        nonlocal score
        score += points
        factors.append({"factor": label, "points": points})

    age = _g(patient, "age", 0) or 0
    if age > 75:
        add(40, "Age over 75")
    elif age > 65:
        add(20, "Age 66–75")
    elif age > 55:
        add(10, "Age 56–65")

    history = [
        ("hypertension", 12, "Hypertension"),
        ("diabetes", 12, "Diabetes"),
        ("history_of_stroke", 18, "History of stroke"),
        ("family_history_of_alzheimers", 22, "Family history of Alzheimer's"),
        ("depression", 8, "Depression"),
        ("alcohol_use", 6, "Alcohol use"),
        ("memory_complaints", 10, "Memory complaints"),
        ("language_difficulties", 8, "Language difficulties"),
        ("orientation_problems", 10, "Orientation problems"),
        ("mood_behavioral_changes", 6, "Mood/behavioral changes"),
    ]
    for field, pts, label in history:
        if _g(patient, field):
            add(pts, label)

    if _g(patient, "smoking_status") == "Current":
        add(6, "Current smoker")
    if _g(patient, "physical_activity") == "None":
        add(5, "No physical activity")
    sleep = _g(patient, "sleep_hours_per_day")
    if sleep is not None and (sleep < 5 or sleep > 10):
        add(4, "Abnormal sleep duration")

    mmse = _g(patient, "mmse_score")
    if mmse is not None:
        if mmse < 20:
            add(40, "MMSE < 20 (severe)")
        elif mmse < 24:
            add(20, "MMSE 20–23 (impaired)")
        elif mmse < 27:
            add(8, "MMSE 24–26 (borderline)")

    moca = _g(patient, "moca_score")
    if moca is not None:
        if moca < 18:
            add(30, "MoCA < 18 (severe)")
        elif moca < 26:
            add(12, "MoCA 18–25 (impaired)")

    risk = max(2, min(score, 98))
    status, code = status_for_risk(risk)
    factors.sort(key=lambda f: f["points"], reverse=True)
    return {"risk": float(risk), "predicted_status": status, "status_code": code, "factors": factors}


def status_for_risk(risk):
    """Map a 0–100 risk to (label, code)."""
    if risk > 70:
        return AD, 2
    if risk > 35:
        return MCI, 1
    return NORMAL, 0


def get_recommendations(status):
    """English clinical recommendation text for a predicted status label."""
    if "AD" in status:
        return (
            "Indicators suggest a high likelihood of cognitive impairment. Please consult a "
            "neurologist promptly for a comprehensive evaluation, and coordinate daily-living "
            "support with a caregiver. This screening result is not a clinical diagnosis."
        )
    if "MCI" in status:
        return (
            "Some early markers of cognitive change are present. Engage in cognitive exercises "
            "(reading, puzzles), maintain healthy sleep and a balanced diet, stay physically and "
            "socially active, and repeat this assessment in about 6 months to monitor any trend."
        )
    return (
        "Your cognitive-decline risk appears low. Maintain a healthy lifestyle — regular physical "
        "activity, good sleep, social engagement and a balanced diet — and take this assessment "
        "periodically to monitor your trajectory over time."
    )
