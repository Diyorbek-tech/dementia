"""Explainable late fusion of the available modalities.

Each modality contributes a calibrated risk in [0, 100]. We combine them with
literature-informed weights, **renormalizing over whichever modalities are
present** (so a missing/failed modality never zeroes the result), and expose
each modality's contribution plus a confidence derived from coverage and
inter-modality agreement. This is the dissertation's "Fusion" pillar — a
transparent, auditable combiner rather than a black box.
"""
from __future__ import annotations

from .clinical import status_for_risk, get_recommendations

# Default weights (sum to 1). Speech and EEG carry the strongest evidence.
DEFAULT_WEIGHTS = {
    "speech": 0.35,
    "eeg": 0.30,
    "clinical": 0.25,
    "face": 0.10,
}

MODALITY_LABELS = {
    "speech": "Speech & Language",
    "eeg": "EEG",
    "clinical": "Clinical / Questionnaire",
    "face": "Facial",
}


def fuse(modality_risks, weights=None):
    """modality_risks: {modality: risk 0–100 or None}. Returns the fused result."""
    weights = weights or DEFAULT_WEIGHTS
    available = {k: float(v) for k, v in modality_risks.items() if v is not None}

    if not available:
        return {
            "overall_risk": 0.0, "predicted_status": "Normal", "status_code": 0,
            "confidence": 0.0, "modalities_used": [], "contributions": [],
            "weights": {}, "recommendations": get_recommendations("Normal"),
        }

    sub_w = {k: weights.get(k, 0.0) for k in available}
    total_w = sum(sub_w.values()) or 1.0
    norm_w = {k: w / total_w for k, w in sub_w.items()}

    overall = sum(norm_w[k] * available[k] for k in available)
    overall = round(float(max(1.0, min(99.0, overall))), 1)
    status, code = status_for_risk(overall)

    contributions = [
        {
            "modality": k,
            "label": MODALITY_LABELS.get(k, k),
            "risk": round(available[k], 1),
            "weight": round(norm_w[k], 3),
            "contribution": round(norm_w[k] * available[k], 1),
        }
        for k in sorted(available, key=lambda x: norm_w[x] * available[x], reverse=True)
    ]

    confidence = _confidence(list(available.values()), len(available))

    return {
        "overall_risk": overall,
        "predicted_status": status,
        "status_code": code,
        "confidence": confidence,
        "modalities_used": list(available.keys()),
        "contributions": contributions,
        "weights": {k: round(v, 3) for k, v in norm_w.items()},
        "recommendations": get_recommendations(status),
    }


def _confidence(risks, n_modalities):
    """Confidence from coverage (more modalities) + agreement (lower spread)."""
    import statistics

    coverage = n_modalities / len(DEFAULT_WEIGHTS)
    if len(risks) > 1:
        spread = statistics.pstdev(risks)
        agreement = max(0.0, 1.0 - spread / 50.0)  # 50-pt spread ⇒ 0 agreement
    else:
        agreement = 0.5  # single modality: moderate confidence
    return round(100.0 * (0.6 * coverage + 0.4 * agreement), 0)
