"""Speech analysis: acoustic + linguistic biomarkers of cognitive decline.

Pipeline (all heavy libs imported lazily; each stage degrades gracefully):
  1. Load + resample audio (librosa, ffmpeg-backed → handles webm).
  2. Acoustic features: pauses, speech rate, F0, jitter/shimmer (parselmouth).
  3. Transcription: faster-whisper ``base.en`` (English required).
  4. Linguistic features: lexical diversity, fluency, syntactic complexity
     (spaCy if available, else textstat + heuristics).
  5. Calibrated risk score from literature-grounded feature directions.

This is a feature-based scorer (not yet trained on labeled clinical speech);
the documented upgrade path is training on ADReSS / DementiaBank.
"""
from __future__ import annotations

import logging
import re

logger = logging.getLogger("patients")

_WHISPER_MODEL = None
_SPACY_NLP = None
_FILLERS = {"um", "uh", "er", "erm", "ah", "like", "hmm", "uhh", "umm"}
TARGET_SR = 16000


# ── Model singletons ──────────────────────────────────────────────────────────
def _get_whisper():
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        from faster_whisper import WhisperModel
        try:
            from django.conf import settings
            size = getattr(settings, "WHISPER_MODEL_SIZE", "base.en")
        except Exception:
            size = "base.en"
        _WHISPER_MODEL = WhisperModel(size, device="cpu", compute_type="int8")
    return _WHISPER_MODEL


def _get_spacy():
    global _SPACY_NLP
    if _SPACY_NLP is None:
        try:
            import spacy
            _SPACY_NLP = spacy.load("en_core_web_sm", disable=["ner", "lemmatizer"])
        except Exception:  # model not installed → linguistic falls back to heuristics
            _SPACY_NLP = False
    return _SPACY_NLP or None


# ── Audio loading & acoustic features ─────────────────────────────────────────
def _load_audio(path):
    import librosa

    y, sr = librosa.load(path, sr=TARGET_SR, mono=True)
    return y, sr


def _acoustic_features(y, sr):
    import numpy as np
    import librosa

    duration = float(len(y) / sr) if sr else 0.0
    feats = {"duration_s": round(duration, 2)}

    # Pause detection via frame RMS energy.
    frame, hop = 1024, 256
    rms = librosa.feature.rms(y=y, frame_length=frame, hop_length=hop)[0]
    if rms.size:
        thresh = max(float(np.median(rms) * 0.5), float(rms.max() * 0.08))
        voiced = rms > thresh
        frame_dur = hop / sr
        # Count silent runs >= 150 ms as pauses.
        pauses, run = [], 0
        for v in voiced:
            if not v:
                run += 1
            else:
                if run * frame_dur >= 0.15:
                    pauses.append(run * frame_dur)
                run = 0
        if run * frame_dur >= 0.15:
            pauses.append(run * frame_dur)
        voiced_time = float(voiced.sum()) * frame_dur
        feats["pause_count"] = len(pauses)
        feats["total_pause_s"] = round(float(sum(pauses)), 2)
        feats["pause_ratio"] = round(float(1 - voiced_time / max(duration, 1e-6)), 3)
        feats["voiced_ratio"] = round(float(voiced_time / max(duration, 1e-6)), 3)
    else:
        feats.update(pause_count=0, total_pause_s=0.0, pause_ratio=0.0, voiced_ratio=0.0)

    # MFCC summary (timbre stability).
    try:
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        feats["mfcc_mean"] = [round(float(x), 3) for x in mfcc.mean(axis=1)]
    except Exception:
        feats["mfcc_mean"] = []

    feats.update(_voice_quality(y, sr))
    return feats


def _voice_quality(y, sr):
    """F0 + jitter/shimmer via Praat (parselmouth); robust to failures."""
    out = {"f0_mean": None, "f0_sd": None, "jitter": None, "shimmer": None}
    try:
        import numpy as np
        import parselmouth
        from parselmouth.praat import call

        snd = parselmouth.Sound(values=y.astype("float64"), sampling_frequency=sr)
        pitch = snd.to_pitch()
        f0 = pitch.selected_array["frequency"]
        f0 = f0[f0 > 0]
        if f0.size:
            out["f0_mean"] = round(float(np.mean(f0)), 1)
            out["f0_sd"] = round(float(np.std(f0)), 1)
        pp = call(snd, "To PointProcess (periodic, cc)", 75, 500)
        out["jitter"] = round(float(call(pp, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)), 4)
        out["shimmer"] = round(float(call([snd, pp], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6)), 4)
    except Exception as exc:  # pragma: no cover - audio-dependent
        logger.info("Voice-quality extraction skipped: %s", exc)
    return out


# ── Transcription & linguistic features ───────────────────────────────────────
def _transcribe(path):
    model = _get_whisper()
    segments, _info = model.transcribe(path, language="en", beam_size=1)
    text = " ".join(seg.text.strip() for seg in segments).strip()
    return text


def _linguistic_features(text, duration_s):
    words = re.findall(r"[a-zA-Z']+", text.lower())
    n = len(words)
    feats = {
        "word_count": n,
        "transcript_chars": len(text),
        "type_token_ratio": round(len(set(words)) / n, 3) if n else 0.0,
        "words_per_min": round(n / (duration_s / 60.0), 1) if duration_s > 0 else 0.0,
        "filler_ratio": round(sum(w in _FILLERS for w in words) / n, 3) if n else 0.0,
    }
    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    feats["sentence_count"] = len(sentences)
    feats["mean_sentence_len"] = round(n / len(sentences), 1) if sentences else float(n)

    nlp = _get_spacy()
    if nlp and text:
        try:
            doc = nlp(text)
            depths = [_dep_depth(sent.root) for sent in doc.sents]
            feats["syntactic_depth"] = round(sum(depths) / len(depths), 2) if depths else 0.0
            feats["spacy_available"] = True
        except Exception:
            feats["syntactic_depth"] = None
            feats["spacy_available"] = False
    else:
        feats["syntactic_depth"] = None
        feats["spacy_available"] = False

    try:
        import textstat
        feats["flesch_reading_ease"] = round(float(textstat.flesch_reading_ease(text)), 1) if text else None
    except Exception:
        feats["flesch_reading_ease"] = None
    return feats


def _dep_depth(token, depth=1):
    children = list(token.children)
    if not children:
        return depth
    return max(_dep_depth(c, depth + 1) for c in children)


# ── Scoring ───────────────────────────────────────────────────────────────────
def _norm(value, low, high):
    """Map value∈[low,high] → risk∈[0,1] (clamped); low=0 risk, high=1 risk."""
    if value is None:
        return None
    if high == low:
        return 0.0
    return max(0.0, min(1.0, (value - low) / (high - low)))


def score_speech(acoustic, linguistic):
    contributions = {
        "pauses": _norm(acoustic.get("pause_ratio"), 0.20, 0.60),
        "speech_rate": _norm(-linguistic.get("words_per_min", 0), -130, -60),
        "lexical_diversity": _norm(-linguistic.get("type_token_ratio", 0), -0.60, -0.30),
        "fillers": _norm(linguistic.get("filler_ratio"), 0.0, 0.10),
        "syntactic_complexity": _norm(-(linguistic.get("syntactic_depth") or 0), -4.5, -2.0)
        if linguistic.get("syntactic_depth") is not None else None,
    }
    vals = [v for v in contributions.values() if v is not None]
    risk = round(100.0 * (sum(vals) / len(vals)), 1) if vals else 1.0
    risk = float(max(1.0, min(99.0, risk)))

    biomarkers = [
        {"name": "Pause ratio", "value": f"{acoustic.get('pause_ratio', 0) * 100:.0f}%",
         "normal_range": "< 30%", "status": "high" if acoustic.get("pause_ratio", 0) > 0.30 else "normal",
         "note": "Frequent/long pauses reflect word-finding difficulty."},
        {"name": "Speech rate", "value": f"{linguistic.get('words_per_min', 0):.0f} wpm",
         "normal_range": "> 110 wpm", "status": "low" if linguistic.get("words_per_min", 0) < 110 else "normal",
         "note": "Slower speech is associated with cognitive decline."},
        {"name": "Lexical diversity (TTR)", "value": linguistic.get("type_token_ratio", 0),
         "normal_range": "> 0.45", "status": "low" if linguistic.get("type_token_ratio", 0) < 0.45 else "normal",
         "note": "Reduced vocabulary variety is an early language marker."},
        {"name": "Filler ratio", "value": f"{linguistic.get('filler_ratio', 0) * 100:.1f}%",
         "normal_range": "< 5%", "status": "high" if linguistic.get("filler_ratio", 0) > 0.05 else "normal"},
    ]
    if linguistic.get("syntactic_depth") is not None:
        biomarkers.append({
            "name": "Syntactic complexity", "value": linguistic.get("syntactic_depth"),
            "normal_range": "> 3.0", "status": "low" if linguistic["syntactic_depth"] < 3.0 else "normal",
            "note": "Simpler sentence structure can indicate decline."})
    return risk, {k: (round(v, 3) if v is not None else None) for k, v in contributions.items()}, biomarkers


# ── Public entry point ────────────────────────────────────────────────────────
def analyze_speech(path):
    y, sr = _load_audio(path)
    acoustic = _acoustic_features(y, sr)

    transcript = ""
    try:
        transcript = _transcribe(path)
    except Exception as exc:  # pragma: no cover - model/audio dependent
        logger.warning("Speech transcription failed: %s", exc)

    linguistic = _linguistic_features(transcript, acoustic.get("duration_s", 0.0))
    risk, contributions, biomarkers = score_speech(acoustic, linguistic)

    return {
        "risk": risk,
        "transcript": transcript,
        "acoustic": acoustic,
        "linguistic": linguistic,
        "contributions": contributions,
        "biomarkers": biomarkers,
        "transcription_available": bool(transcript),
    }
