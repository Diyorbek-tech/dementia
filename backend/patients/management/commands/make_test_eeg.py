"""Generate synthetic EEG test files users can upload to exercise the pipeline.

Writes one CSV per class (Normal / MCI / AD) of 19-channel, 256 Hz EEG whose
band structure matches the documented biomarkers, to data/sample_uploads/.
Also used as a manual sanity check of the generator.
"""
import os

from django.core.management.base import BaseCommand

from patients.analysis.eeg_synth import CLASS_CODES, generate_dataframe

OUT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "../../data/sample_uploads"))


class Command(BaseCommand):
    help = "Generate synthetic EEG CSV test files (Normal/MCI/AD)."

    def add_arguments(self, parser):
        parser.add_argument("--seconds", type=int, default=20)
        parser.add_argument("--fs", type=int, default=256)

    def handle(self, *args, **options):
        os.makedirs(OUT_DIR, exist_ok=True)
        seconds, fs = options["seconds"], options["fs"]
        for name, code in CLASS_CODES.items():
            # `status` column omitted so it looks like a real unlabeled upload.
            df = generate_dataframe(code, n_seconds=seconds, fs=fs, seed=1000 + code, with_label=False)
            path = os.path.join(OUT_DIR, f"sample_eeg_{name.lower()}.csv")
            df.to_csv(path, index=False)
            self.stdout.write(self.style.SUCCESS(
                f"Wrote {name} sample ({len(df)} rows x {df.shape[1]} ch) -> {path}"
            ))
