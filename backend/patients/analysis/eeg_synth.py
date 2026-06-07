"""Band-power-faithful synthetic EEG generator.

Produces per-timepoint, multi-channel EEG whose spectral content reproduces the
documented dementia biomarkers:

- **Normal (HC):** posterior-dominant alpha (~10 Hz), low delta/theta.
- **MCI:** intermediate — mild alpha attenuation, mild theta rise.
- **AD:** "slowing" — elevated delta/theta, attenuated alpha/beta.

Used both to (a) bootstrap a working classifier at image-build time when the
real Kaggle dataset has not been imported, and (b) generate downloadable test
files so users can exercise the real upload→analysis path. Swap in the real
data with ``import_kaggle_eeg`` + ``train_eeg_model`` for the dissertation model.

numpy/pandas are imported lazily so this module imports without them.
"""
from __future__ import annotations

# Standard 10–20 montage used by the ds004504 / Kaggle dataset (19 channels).
STANDARD_CHANNELS = [
    "Fp1", "Fp2", "F7", "F3", "Fz", "F4", "F8", "T3", "C3", "Cz",
    "C4", "T4", "T5", "P3", "Pz", "P4", "T6", "O1", "O2",
]
POSTERIOR_CHANNELS = {"P3", "Pz", "P4", "O1", "O2", "T5", "T6"}

CLASS_CODES = {"Normal": 0, "MCI": 1, "AD": 2}
CODE_TO_NAME = {0: "Normal", 1: "MCI", 2: "AD"}

BANDS = {
    "delta": (0.5, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 45.0),
}

# Relative band-gain profile per class (delta, theta, alpha, beta, gamma).
_BAND_GAINS = {
    0: {"delta": 0.25, "theta": 0.30, "alpha": 1.00, "beta": 0.55, "gamma": 0.20},
    1: {"delta": 0.55, "theta": 0.70, "alpha": 0.60, "beta": 0.40, "gamma": 0.20},
    2: {"delta": 1.00, "theta": 1.00, "alpha": 0.30, "beta": 0.25, "gamma": 0.15},
}


def _shaped_noise(n, fs, gains, rng):
    """White noise spectrally shaped to a target per-band power profile."""
    import numpy as np

    freqs = np.fft.rfftfreq(n, d=1.0 / fs)
    # 1/f baseline so the signal looks EEG-like even outside the named bands.
    shape = (1.0 / np.maximum(freqs, 1.0) ** 0.5) * 0.15
    for band, (lo, hi) in BANDS.items():
        mask = (freqs >= lo) & (freqs < hi)
        shape[mask] += gains[band]
    white = rng.normal(size=freqs.shape) + 1j * rng.normal(size=freqs.shape)
    sig = np.fft.irfft(white * shape, n=n)
    sig = sig / (np.std(sig) + 1e-9) * 20.0  # ~20 µV RMS
    return sig.astype("float32")


def generate_eeg(class_code, n_seconds=20, fs=256, channels=None, seed=0):
    """Return ``{channel: ndarray[n_seconds*fs]}`` for one class."""
    import numpy as np

    channels = channels or STANDARD_CHANNELS
    rng = np.random.default_rng(seed)
    n = int(n_seconds * fs)
    base = _BAND_GAINS[int(class_code)]
    cols = {}
    for ch in channels:
        g = dict(base)
        if ch in POSTERIOR_CHANNELS:
            g["alpha"] *= 1.4  # posterior alpha dominance
        g = {k: v * float(rng.uniform(0.9, 1.1)) for k, v in g.items()}
        cols[ch] = _shaped_noise(n, fs, g, rng)
    return cols


def generate_dataframe(class_code, n_seconds=20, fs=256, channels=None, seed=0, with_label=True):
    """Return a per-timepoint DataFrame (channel columns + optional ``status``)."""
    import pandas as pd

    cols = generate_eeg(class_code, n_seconds, fs, channels, seed)
    df = pd.DataFrame(cols)
    if with_label:
        df["status"] = int(class_code)
    return df


def build_training_frame(per_class_subjects=12, n_seconds=12, fs=256, channels=None, seed=0):
    """Balanced multi-class per-timepoint frame for bootstrapping the classifier."""
    import pandas as pd

    frames = []
    s = seed
    for code in (0, 1, 2):
        for _ in range(per_class_subjects):
            frames.append(generate_dataframe(code, n_seconds, fs, channels, seed=s))
            s += 1
    return pd.concat(frames, ignore_index=True)
