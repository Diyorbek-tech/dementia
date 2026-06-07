"""Face-video analysis: facial expressivity, blink rate and movement.

Reduced facial expressivity (**hypomimia**) and altered blink dynamics are
associated with neurodegeneration. We sample frames with OpenCV, extract 468
face landmarks with MediaPipe FaceMesh (bundled model — no extra download),
and derive scale-invariant biomarkers, then map them to a calibrated risk.

Feature-based scorer; documented as such. Heavy libs imported lazily.
"""
from __future__ import annotations

import logging

logger = logging.getLogger("patients")

# MediaPipe FaceMesh landmark indices.
_R_EYE = [33, 160, 158, 133, 153, 144]
_L_EYE = [362, 385, 387, 263, 373, 380]
_MOUTH_UP, _MOUTH_LOW, _MOUTH_L, _MOUTH_R = 13, 14, 61, 291
_BROW_L, _EYE_TOP_L, _BROW_R, _EYE_TOP_R = 105, 159, 334, 386
_NOSE, _EYE_OUT_L, _EYE_OUT_R = 1, 33, 263

TARGET_FPS = 5.0
EAR_BLINK_THRESHOLD = 0.21


def _dist(a, b):
    import numpy as np
    return float(np.hypot(a[0] - b[0], a[1] - b[1]))


def _ear(pts, idx):
    p1, p2, p3, p4, p5, p6 = (pts[i] for i in idx)
    denom = 2.0 * _dist(p1, p4) + 1e-9
    return (_dist(p2, p6) + _dist(p3, p5)) / denom


def _frame_metrics(pts):
    """Scale-invariant facial metrics for one frame (pts: list of (x,y))."""
    scale = _dist(pts[_EYE_OUT_L], pts[_EYE_OUT_R]) + 1e-9  # inter-ocular distance
    ear = (_ear(pts, _R_EYE) + _ear(pts, _L_EYE)) / 2.0
    return {
        "ear": ear,
        "mouth_open": _dist(pts[_MOUTH_UP], pts[_MOUTH_LOW]) / scale,
        "mouth_width": _dist(pts[_MOUTH_L], pts[_MOUTH_R]) / scale,
        "brow_raise": (_dist(pts[_BROW_L], pts[_EYE_TOP_L]) + _dist(pts[_BROW_R], pts[_EYE_TOP_R])) / (2 * scale),
        "nose": pts[_NOSE],
        "scale": scale,
    }


def _extract_frames(path):
    """Yield (landmarks list[(x,y)]) for sampled frames; track detection rate."""
    import cv2
    import mediapipe as mp

    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError("Could not open video file.")
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    step = max(1, int(round(src_fps / TARGET_FPS)))

    mesh = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=False, max_num_faces=1, refine_landmarks=True,
        min_detection_confidence=0.5,
    )
    frames_seen = detections = 0
    metrics = []
    idx = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if idx % step == 0:
                frames_seen += 1
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                res = mesh.process(rgb)
                if res.multi_face_landmarks:
                    detections += 1
                    lm = res.multi_face_landmarks[0].landmark
                    pts = [(p.x, p.y) for p in lm]
                    metrics.append(_frame_metrics(pts))
            idx += 1
    finally:
        cap.release()
        mesh.close()
    return metrics, frames_seen, detections, src_fps


def _aggregate(metrics, frames_seen, src_fps):
    import numpy as np

    if not metrics:
        return {"detection_rate": 0.0, "frames_analyzed": frames_seen}

    ear = np.array([m["ear"] for m in metrics])
    mouth_open = np.array([m["mouth_open"] for m in metrics])
    mouth_width = np.array([m["mouth_width"] for m in metrics])
    brow = np.array([m["brow_raise"] for m in metrics])
    nose = np.array([m["nose"] for m in metrics])

    # Blink count: EAR dipping below threshold (debounced rising edges).
    below = ear < EAR_BLINK_THRESHOLD
    blinks = int(np.sum((~below[:-1]) & (below[1:]))) if below.size > 1 else 0
    analyzed_sec = len(metrics) / TARGET_FPS if TARGET_FPS else 1.0
    blink_rate = round(blinks / (analyzed_sec / 60.0), 1) if analyzed_sec > 0 else 0.0

    # Expressivity = combined temporal variability of expression metrics.
    expressivity = float(np.std(mouth_open) + np.std(mouth_width) + np.std(brow))
    head_movement = float(np.std(nose[:, 0]) + np.std(nose[:, 1]))

    return {
        "frames_analyzed": len(metrics),
        "detection_rate": round(len(metrics) / max(frames_seen, 1), 3),
        "blink_count": blinks,
        "blink_rate_per_min": blink_rate,
        "expressivity": round(expressivity, 4),
        "mouth_movement": round(float(np.std(mouth_open)), 4),
        "brow_movement": round(float(np.std(brow)), 4),
        "head_movement": round(head_movement, 4),
        "analyzed_seconds": round(analyzed_sec, 1),
    }


def _norm(value, low, high):
    if value is None:
        return None
    if high == low:
        return 0.0
    return max(0.0, min(1.0, (value - low) / (high - low)))


def score_face(feats):
    if not feats.get("frames_analyzed") or feats.get("detection_rate", 0) < 0.2:
        return 1.0, {}, [{"name": "Face detection", "value": f"{feats.get('detection_rate', 0) * 100:.0f}%",
                          "normal_range": "> 60%", "status": "low",
                          "note": "Too few frames with a detected face for reliable analysis."}]

    blink = feats.get("blink_rate_per_min", 0)
    blink_abnormality = 0.0
    if blink < 8:
        blink_abnormality = _norm(8 - blink, 0, 8)        # reduced blinking
    elif blink > 30:
        blink_abnormality = _norm(blink - 30, 0, 30)      # excessive blinking

    contributions = {
        # Low expressivity (hypomimia) → high risk → invert.
        "expressivity": _norm(-feats.get("expressivity", 0), -0.05, -0.005),
        "blink_dynamics": blink_abnormality,
        "head_movement": _norm(-feats.get("head_movement", 0), -0.02, -0.002),
    }
    vals = [v for v in contributions.values() if v is not None]
    risk = round(100.0 * (sum(vals) / len(vals)), 1) if vals else 1.0
    risk = float(max(1.0, min(99.0, risk)))

    biomarkers = [
        {"name": "Facial expressivity", "value": feats.get("expressivity"),
         "normal_range": "> 0.03", "status": "low" if feats.get("expressivity", 0) < 0.03 else "normal",
         "note": "Reduced expressivity (hypomimia) is a neurodegeneration marker."},
        {"name": "Blink rate", "value": f"{blink:.0f}/min", "normal_range": "8–30/min",
         "status": "low" if blink < 8 else ("high" if blink > 30 else "normal"),
         "note": "Abnormal blink dynamics can accompany cognitive decline."},
        {"name": "Head movement", "value": feats.get("head_movement"),
         "normal_range": "> 0.005", "status": "low" if feats.get("head_movement", 0) < 0.005 else "normal"},
    ]
    return risk, {k: (round(v, 3) if v is not None else None) for k, v in contributions.items()}, biomarkers


def analyze_face(path):
    metrics, frames_seen, detections, src_fps = _extract_frames(path)
    feats = _aggregate(metrics, frames_seen, src_fps)
    risk, contributions, biomarkers = score_face(feats)
    return {
        "risk": risk,
        "features": feats,
        "contributions": contributions,
        "biomarkers": biomarkers,
        "detection_available": feats.get("detection_rate", 0) >= 0.2,
    }
