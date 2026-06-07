"""Train the EEG cognitive-decline classifier.

Data source priority:
  1. ``data/eeg_train.csv``           (real Kaggle export, if placed there)
  2. ``data/eeg_samples.json``        (only if it contains >1 class)
  3. synthetic multi-class bootstrap  (so the image always builds a model)

Each per-timepoint frame is grouped by label and windowed into 1-second
segments; band-power features (see analysis/eeg.py) are extracted per window
and a RandomForest is trained with stratified CV. The bundle (model + feature
names + classes + CV metrics + fs) is saved to ML_MODELS_DIR/eeg_model.joblib.
"""
import json
import os

from django.conf import settings
from django.core.management.base import BaseCommand

from patients.analysis import eeg as eeg_mod
from patients.analysis.eeg_synth import STANDARD_CHANNELS, build_training_frame

DATA_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "../../data"))

_LABEL_MAP = {
    "hc": 0, "cn": 0, "normal": 0, "healthy": 0, "control": 0,
    "mci": 1, "ftd": 1,
    "ad": 2, "alzheimer": 2, "alzheimers": 2, "dementia": 2,
}


class Command(BaseCommand):
    help = "Train the EEG band-power classifier and save it to ML_MODELS_DIR."

    def add_arguments(self, parser):
        parser.add_argument("--synthetic", action="store_true",
                            help="Force synthetic bootstrap data even if a dataset exists.")

    def handle(self, *args, **options):
        import numpy as np
        import pandas as pd

        fs = int(getattr(settings, "EEG_SAMPLING_RATE", 256))
        df = self._load_frame(options.get("synthetic"))
        chan_cols, channels, label_col = self._columns(df)
        self.stdout.write(f"Training on {len(df)} rows, {len(channels)} channels, label='{label_col}'.")

        X, y = [], []
        for label_val, group in df.groupby(label_col):
            code = self._to_code(label_val)
            if code is None:
                continue
            sig = group[chan_cols].to_numpy(dtype="float64")
            for a, b in eeg_mod.window_indices(len(sig), fs):
                feats = eeg_mod.extract_features(sig[a:b], fs, channels)
                X.append(eeg_mod.features_to_vector(feats))
                y.append(code)

        X = np.asarray(X, dtype="float64")
        y = np.asarray(y, dtype="int")
        classes = sorted(set(int(v) for v in y))
        self.stdout.write(f"Built {len(X)} windowed feature vectors; classes={classes}.")
        if len(classes) < 2:
            self.stderr.write("Need >=2 classes to train; aborting.")
            return

        metrics = self._train_and_save(X, y, classes, channels, fs)
        self.stdout.write(self.style.SUCCESS(
            f"EEG model trained. CV accuracy={metrics['cv_accuracy']:.3f} "
            f"macro-F1={metrics['cv_f1_macro']:.3f} -> {eeg_mod._model_path()}"
        ))

    # ── data loading ──────────────────────────────────────────────────────────
    def _load_frame(self, force_synthetic):
        import pandas as pd

        if force_synthetic:
            self.stdout.write("Using synthetic bootstrap dataset (forced).")
            return build_training_frame()

        csv_path = os.path.join(DATA_DIR, "eeg_train.csv")
        if os.path.exists(csv_path):
            self.stdout.write(f"Loading real dataset: {csv_path}")
            return pd.read_csv(csv_path)

        json_path = os.path.join(DATA_DIR, "eeg_samples.json")
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                df = pd.DataFrame(data)
                label_cols = [c for c in df.columns if c.lower() in eeg_mod.LABEL_COLUMN_CANDIDATES]
                if label_cols and df[label_cols[0]].nunique() > 1:
                    self.stdout.write(f"Loading multi-class dataset: {json_path}")
                    return df
                self.stdout.write("eeg_samples.json is single-class; falling back to synthetic.")
            except (OSError, ValueError):
                pass

        self.stdout.write("No multi-class dataset found; generating synthetic bootstrap data.")
        return build_training_frame()

    def _columns(self, df):
        df.columns = [str(c).strip() for c in df.columns]
        std_lower = {c.lower(): c for c in STANDARD_CHANNELS}
        chan_cols = [c for c in df.columns if c.lower() in std_lower]
        label_candidates = [c for c in df.columns if c.lower() in eeg_mod.LABEL_COLUMN_CANDIDATES]
        if not chan_cols:
            import pandas as pd
            chan_cols = [c for c in df.columns
                         if c.lower() not in eeg_mod.NON_CHANNEL_COLUMNS
                         and pd.api.types.is_numeric_dtype(df[c])]
        channels = [std_lower.get(c.lower(), c) for c in chan_cols]
        label_col = label_candidates[0] if label_candidates else df.columns[-1]
        return chan_cols, channels, label_col

    def _to_code(self, value):
        try:
            return int(value)
        except (ValueError, TypeError):
            return _LABEL_MAP.get(str(value).strip().lower())

    # ── training ────────────────────────────────────────────────────────────────
    def _train_and_save(self, X, y, classes, channels, fs):
        import joblib
        import numpy as np
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import StratifiedKFold, cross_val_predict
        from sklearn.metrics import accuracy_score, f1_score

        model = RandomForestClassifier(
            n_estimators=200, max_depth=None, min_samples_leaf=2,
            class_weight="balanced", random_state=42, n_jobs=-1,
        )
        n_splits = min(5, np.bincount(y).min())
        metrics = {"cv_accuracy": 0.0, "cv_f1_macro": 0.0, "n_samples": int(len(X)), "classes": classes}
        if n_splits >= 2:
            skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
            y_pred = cross_val_predict(model, X, y, cv=skf, n_jobs=-1)
            metrics["cv_accuracy"] = float(accuracy_score(y, y_pred))
            metrics["cv_f1_macro"] = float(f1_score(y, y_pred, average="macro"))

        model.fit(X, y)
        bundle = {
            "model": model,
            "feature_names": eeg_mod.FEATURE_NAMES,
            "classes": classes,
            "channels": channels,
            "fs": fs,
            "metrics": metrics,
        }
        os.makedirs(str(settings.ML_MODELS_DIR), exist_ok=True)
        joblib.dump(bundle, eeg_mod._model_path())
        return metrics
