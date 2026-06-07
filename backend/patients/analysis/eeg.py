"""EEG analysis: parse an uploaded recording, extract band-power biomarkers,
and predict a cognitive-decline risk with a trained scikit-learn classifier.

Feature extraction is **channel-count agnostic** (it aggregates per-channel
relative band powers into a fixed named vector), so a model trained on the
16-channel sample still scores a 19-channel upload and vice-versa.

Heavy libs (numpy/scipy/joblib/sklearn/pandas) are imported lazily.
"""
from __future__ import annotations

import logging
import os

from .eeg_synth import BANDS, STANDARD_CHANNELS, CODE_TO_NAME

logger = logging.getLogger("patients")

REGIONS = {
    "frontal": ["Fp1", "Fp2", "F7", "F3", "Fz", "F4", "F8"],
    "temporal": ["T3", "T4", "T5", "T6"],
    "central": ["C3", "Cz", "C4"],
    "parietal": ["P3", "Pz", "P4"],
    "occipital": ["O1", "O2"],
}

# Ordered feature vector consumed by the model (training & inference share this).
FEATURE_NAMES = [
    "rel_delta", "rel_theta", "rel_alpha", "rel_beta", "rel_gamma",
    "ratio_theta_alpha", "ratio_theta_beta", "ratio_slowing",
    "spectral_entropy", "hjorth_mobility", "hjorth_complexity",
    "reg_alpha_frontal", "reg_alpha_temporal", "reg_alpha_parietal", "reg_alpha_occipital",
    "reg_theta_frontal", "reg_theta_temporal", "reg_theta_parietal", "reg_theta_occipital",
]

LABEL_COLUMN_CANDIDATES = {"status", "label", "class", "y", "target", "diagnosis"}
NON_CHANNEL_COLUMNS = LABEL_COLUMN_CANDIDATES | {"time", "timestamp", "index", "unnamed: 0", "id"}

MODEL_FILENAME = "eeg_model.joblib"
_MODEL_CACHE = None  # lazily loaded {model, feature_names, classes, metrics, fs}


# ── Signal-processing primitives ──────────────────────────────────────────────
def _welch(sig, fs):
    from scipy.signal import welch

    nperseg = int(min(len(sig), fs * 2)) or len(sig)
    freqs, psd = welch(sig, fs=fs, nperseg=max(nperseg, 8))
    return freqs, psd


def _bandpower(freqs, psd, lo, hi):
    import numpy as np

    mask = (freqs >= lo) & (freqs < hi)
    if not mask.any():
        return 0.0
    return float(np.trapz(psd[mask], freqs[mask]))


def _spectral_entropy(freqs, psd):
    import numpy as np

    mask = (freqs >= 0.5) & (freqs <= 45)
    p = psd[mask]
    s = p.sum()
    if s <= 0:
        return 0.0
    p = p / s
    p = p[p > 0]
    return float(-(p * np.log2(p)).sum() / np.log2(len(p) + 1e-9))


def _hjorth(sig):
    import numpy as np

    d1 = np.diff(sig)
    d2 = np.diff(d1)
    var0 = np.var(sig) + 1e-12
    var1 = np.var(d1) + 1e-12
    var2 = np.var(d2) + 1e-12
    mobility = float(np.sqrt(var1 / var0))
    complexity = float(np.sqrt(var2 / var1) / (mobility + 1e-12))
    return mobility, complexity


def _channel_rel_powers(sig, fs):
    """Relative power per band for one channel (fractions summing ~1)."""
    freqs, psd = _welch(sig, fs)
    abs_p = {b: _bandpower(freqs, psd, lo, hi) for b, (lo, hi) in BANDS.items()}
    total = sum(abs_p.values()) + 1e-12
    rel = {b: v / total for b, v in abs_p.items()}
    return rel, freqs, psd


# ── Feature extraction ────────────────────────────────────────────────────────
def extract_features(signal, fs, channels):
    """signal: ndarray[T, C]; channels: list[str]. Returns a dict over FEATURE_NAMES."""
    import numpy as np

    signal = np.asarray(signal, dtype="float64")
    if signal.ndim == 1:
        signal = signal[:, None]
    n_ch = signal.shape[1]

    per_ch_rel, ent_list, mob_list, cmp_list = [], [], [], []
    for c in range(n_ch):
        sig = signal[:, c]
        if np.allclose(sig, sig[0] if len(sig) else 0):
            continue
        rel, freqs, psd = _channel_rel_powers(sig, fs)
        per_ch_rel.append(rel)
        ent_list.append(_spectral_entropy(freqs, psd))
        mob, comp = _hjorth(sig)
        mob_list.append(mob)
        cmp_list.append(comp)

    if not per_ch_rel:  # all-flat signal
        return {name: 0.0 for name in FEATURE_NAMES}

    def gmean(band):
        return float(np.mean([r[band] for r in per_ch_rel]))

    rel_delta, rel_theta = gmean("delta"), gmean("theta")
    rel_alpha, rel_beta, rel_gamma = gmean("alpha"), gmean("beta"), gmean("gamma")

    feats = {
        "rel_delta": rel_delta, "rel_theta": rel_theta, "rel_alpha": rel_alpha,
        "rel_beta": rel_beta, "rel_gamma": rel_gamma,
        "ratio_theta_alpha": rel_theta / (rel_alpha + 1e-6),
        "ratio_theta_beta": rel_theta / (rel_beta + 1e-6),
        "ratio_slowing": (rel_delta + rel_theta) / (rel_alpha + rel_beta + 1e-6),
        "spectral_entropy": float(np.mean(ent_list)),
        "hjorth_mobility": float(np.mean(mob_list)),
        "hjorth_complexity": float(np.mean(cmp_list)),
    }

    # Regional alpha/theta (averaged over the region's available channels).
    name_to_idx = {ch: i for i, ch in enumerate(channels)}
    for region, chs in REGIONS.items():
        idxs = [name_to_idx[ch] for ch in chs if ch in name_to_idx and name_to_idx[ch] < len(per_ch_rel)]
        if idxs:
            feats[f"reg_alpha_{region}"] = float(np.mean([per_ch_rel[i]["alpha"] for i in idxs]))
            feats[f"reg_theta_{region}"] = float(np.mean([per_ch_rel[i]["theta"] for i in idxs]))
        else:
            feats.setdefault(f"reg_alpha_{region}", rel_alpha)
            feats.setdefault(f"reg_theta_{region}", rel_theta)
    # occipital may be absent in 16-ch data
    for region in REGIONS:
        feats.setdefault(f"reg_alpha_{region}", rel_alpha)
        feats.setdefault(f"reg_theta_{region}", rel_theta)
    return feats


def features_to_vector(feat):
    return [float(feat.get(n, 0.0)) for n in FEATURE_NAMES]


def window_indices(n_samples, fs):
    """Non-overlapping 1-second windows; whole signal if shorter than 1 s."""
    win = int(fs)
    if n_samples < win:
        return [(0, n_samples)]
    return [(i, i + win) for i in range(0, n_samples - win + 1, win)]


def extract_window_features(signal, fs, channels, max_windows=60):
    import numpy as np

    signal = np.asarray(signal, dtype="float64")
    if signal.ndim == 1:
        signal = signal[:, None]
    idxs = window_indices(signal.shape[0], fs)[:max_windows]
    return [extract_features(signal[a:b, :], fs, channels) for a, b in idxs]


# ── Parsing uploaded files ────────────────────────────────────────────────────
def parse_eeg(path, fs=None):
    """Return (signal ndarray[T, C], fs, channel_names)."""
    import numpy as np

    if fs is None:
        try:
            from django.conf import settings
            fs = int(getattr(settings, "EEG_SAMPLING_RATE", 256))
        except Exception:
            fs = 256

    ext = os.path.splitext(path)[1].lower()
    if ext in (".csv", ".txt"):
        import pandas as pd

        df = pd.read_csv(path)
        df.columns = [str(c).strip() for c in df.columns]
        std_lower = {c.lower(): c for c in STANDARD_CHANNELS}
        chan_cols = [c for c in df.columns if c.lower() in std_lower]
        if not chan_cols:  # fall back to numeric, non-label columns
            chan_cols = [
                c for c in df.columns
                if c.lower() not in NON_CHANNEL_COLUMNS
                and pd.api.types.is_numeric_dtype(df[c])
            ]
        if not chan_cols:
            raise ValueError("No EEG channel columns found in CSV.")
        channels = [std_lower.get(c.lower(), c) for c in chan_cols]
        signal = df[chan_cols].to_numpy(dtype="float64")
        return signal, fs, channels

    if ext == ".edf":
        try:
            import mne
        except ImportError as exc:  # pragma: no cover
            raise ValueError("EDF upload requires the optional 'mne' package; please upload CSV.") from exc
        raw = mne.io.read_raw_edf(path, preload=True, verbose="ERROR")
        fs = int(raw.info["sfreq"])
        data = raw.get_data().T  # [T, C]
        channels = list(raw.ch_names)
        return data, fs, channels

    raise ValueError(f"Unsupported EEG file type: {ext}. Upload a .csv (or .edf).")


# ── Model loading ─────────────────────────────────────────────────────────────
def _model_path():
    from django.conf import settings

    return os.path.join(str(settings.ML_MODELS_DIR), MODEL_FILENAME)


def load_model():
    global _MODEL_CACHE
    if _MODEL_CACHE is not None:
        return _MODEL_CACHE
    path = _model_path()
    if not os.path.exists(path):
        logger.warning("EEG model not found at %s; using heuristic fallback.", path)
        return None
    import joblib

    _MODEL_CACHE = joblib.load(path)
    return _MODEL_CACHE


# ── Public entry point ────────────────────────────────────────────────────────
def _waveform_preview(signal, fs, channels, max_points=240, max_channels=8):
    import numpy as np

    preferred = ["Fp1", "F3", "C3", "P3", "O1", "Fp2", "C4", "O2"]
    name_to_idx = {ch: i for i, ch in enumerate(channels)}
    picked = [ch for ch in preferred if ch in name_to_idx][:max_channels]
    if not picked:
        picked = channels[:max_channels]
    n = signal.shape[0]
    step = max(1, n // max_points)
    series = []
    for r in range(0, min(n, max_points * step), step):
        point = {"i": int(r)}
        for ch in picked:
            point[ch] = round(float(signal[r, name_to_idx.get(ch, 0)]), 2)
        series.append(point)
    return {"channels": picked, "series": series}


def _biomarkers(agg):
    """Interpretable EEG biomarkers with reference ranges (relative power %)."""
    def flag(value, hi=None, lo=None):
        if hi is not None and value > hi:
            return "high"
        if lo is not None and value < lo:
            return "low"
        return "normal"

    return [
        {"name": "Theta/Alpha ratio", "value": round(agg["ratio_theta_alpha"], 2),
         "normal_range": "< 1.0", "status": flag(agg["ratio_theta_alpha"], hi=1.0),
         "note": "Elevated ratio indicates EEG slowing (dementia marker)."},
        {"name": "Slowing ratio (δ+θ)/(α+β)", "value": round(agg["ratio_slowing"], 2),
         "normal_range": "< 1.2", "status": flag(agg["ratio_slowing"], hi=1.2),
         "note": "Higher = more low-frequency dominance."},
        {"name": "Relative alpha power", "value": f"{agg['rel_alpha'] * 100:.1f}%",
         "normal_range": "> 25%", "status": flag(agg["rel_alpha"], lo=0.25),
         "note": "Reduced posterior alpha is an early AD marker."},
        {"name": "Relative theta power", "value": f"{agg['rel_theta'] * 100:.1f}%",
         "normal_range": "< 25%", "status": flag(agg["rel_theta"], hi=0.25),
         "note": "Increased theta accompanies cognitive decline."},
        {"name": "Relative delta power", "value": f"{agg['rel_delta'] * 100:.1f}%",
         "normal_range": "< 20%", "status": flag(agg["rel_delta"], hi=0.20)},
    ]


def analyze_eeg(path, fs=None):
    """Full EEG analysis for one uploaded file → result dict (JSON-serializable)."""
    import numpy as np

    signal, fs, channels = parse_eeg(path, fs)
    if signal.shape[0] < 16:
        raise ValueError("EEG recording too short to analyze.")

    window_feats = extract_window_features(signal, fs, channels)
    # Aggregate features across windows for the displayed biomarkers/bands.
    agg = {name: float(np.mean([wf[name] for wf in window_feats])) for name in FEATURE_NAMES}

    model_bundle = load_model()
    probabilities = {"Normal": 0.0, "MCI": 0.0, "AD": 0.0}
    model_available = False

    if model_bundle is not None:
        model = model_bundle["model"]
        X = [features_to_vector(wf) for wf in window_feats]
        proba = model.predict_proba(X)  # [n_windows, n_classes]
        mean_proba = np.mean(proba, axis=0)
        classes = list(model_bundle.get("classes", model.classes_))
        for cls, p in zip(classes, mean_proba):
            probabilities[CODE_TO_NAME.get(int(cls), str(cls))] = round(float(p), 4)
        model_available = True
    else:
        # Heuristic fallback from the slowing ratio (logistic-ish).
        slow = agg["ratio_slowing"]
        p_ad = float(np.clip((slow - 0.8) / 1.6, 0.02, 0.95))
        p_norm = float(np.clip(1.0 - slow / 1.5, 0.02, 0.95))
        p_mci = max(0.02, 1.0 - p_ad - p_norm)
        s = p_norm + p_mci + p_ad
        probabilities = {"Normal": round(p_norm / s, 4), "MCI": round(p_mci / s, 4), "AD": round(p_ad / s, 4)}

    risk = 100.0 * (0.5 * probabilities["MCI"] + 1.0 * probabilities["AD"])
    risk = float(np.clip(risk, 1.0, 99.0))
    predicted_class = max(probabilities, key=probabilities.get)

    band_powers = {b: round(agg[f"rel_{b}"] * 100, 2) for b in BANDS}  # relative %, for chart

    return {
        "risk": round(risk, 1),
        "predicted_class": predicted_class,
        "probabilities": probabilities,
        "band_powers": band_powers,
        "ratios": {
            "theta_alpha": round(agg["ratio_theta_alpha"], 3),
            "theta_beta": round(agg["ratio_theta_beta"], 3),
            "slowing": round(agg["ratio_slowing"], 3),
        },
        "biomarkers": _biomarkers(agg),
        "channels": channels,
        "n_channels": len(channels),
        "fs": fs,
        "n_windows": len(window_feats),
        "duration_s": round(signal.shape[0] / fs, 1),
        "waveform_preview": _waveform_preview(signal, fs, channels),
        "model_available": model_available,
    }
