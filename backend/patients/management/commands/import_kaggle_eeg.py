"""Import the real Kaggle EEG Alzheimer's dataset for training.

Downloads ``ucimachinelearning/eeg-alzheimers-dataset`` (OpenNeuro ds004504-
derived: 19 channels @ 256 Hz, classes AD/FTD/HC), then writes a **balanced,
multi-class** sample to ``data/eeg_train.csv`` — which ``train_eeg_model``
prefers over the synthetic bootstrap.

Run locally with Kaggle credentials, then re-run ``train_eeg_model`` to fit the
classifier on the real data for the dissertation.
"""
import os

from django.core.management.base import BaseCommand

DATA_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "../../data"))
LABEL_CANDIDATES = {"status", "label", "class", "y", "target", "diagnosis"}


class Command(BaseCommand):
    help = "Import the Kaggle EEG Alzheimer's dataset (balanced, all classes)."

    def add_arguments(self, parser):
        parser.add_argument("--per-class", type=int, default=30000,
                            help="Max rows kept per class (controls file size).")

    def handle(self, *args, **options):
        import pandas as pd

        self.stdout.write("Downloading dataset from Kaggle...")
        try:
            import kagglehub
            path = kagglehub.dataset_download("ucimachinelearning/eeg-alzheimers-dataset")
        except Exception as e:  # pragma: no cover - network/credentials
            self.stderr.write(f"Error downloading dataset: {e}")
            self.stderr.write("Install kagglehub and configure Kaggle credentials, then retry.")
            return

        csv_file = None
        for root, _dirs, files in os.walk(path):
            for f in files:
                if f.endswith(".csv"):
                    csv_file = os.path.join(root, f)
                    break
            if csv_file:
                break
        if not csv_file:
            self.stderr.write("No CSV file found in the dataset.")
            return

        self.stdout.write(f"Loading {csv_file} ...")
        df = pd.read_csv(csv_file)
        df.columns = [str(c).strip() for c in df.columns]

        label_cols = [c for c in df.columns if c.lower() in LABEL_CANDIDATES]
        if not label_cols:
            self.stderr.write(f"No label column found among {list(df.columns)}.")
            return
        label_col = label_cols[0]

        per_class = options["per_class"]
        balanced = (
            df.groupby(label_col, group_keys=False)
            .apply(lambda g: g.sample(min(len(g), per_class), random_state=42))
            .reset_index(drop=True)
        )

        os.makedirs(DATA_DIR, exist_ok=True)
        out_path = os.path.join(DATA_DIR, "eeg_train.csv")
        balanced.to_csv(out_path, index=False)

        counts = balanced[label_col].value_counts().to_dict()
        self.stdout.write(self.style.SUCCESS(
            f"Wrote {len(balanced)} rows to {out_path}; class counts={counts}. "
            f"Now run: python manage.py train_eeg_model"
        ))
