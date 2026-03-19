import pandas as pd
import kagglehub
from django.core.management.base import BaseCommand
import json
import os

class Command(BaseCommand):
    help = 'Imports a subset of the EEG Alzheimer\'s dataset from Kaggle'

    def handle(self, *args, **options):
        self.stdout.write("Downloading dataset from Kaggle...")
        try:
            path = kagglehub.dataset_download("ucimachinelearning/eeg-alzheimers-dataset")
        except Exception as e:
            self.stderr.write(f"Error downloading dataset: {e}")
            return
        
        # Look for the CSV file in the downloaded path
        csv_file = None
        for root, dirs, files in os.walk(path):
            if csv_file: break
            for file in files:
                if file.endswith(".csv"):
                    csv_file = os.path.join(root, file)
                    break
        
        if not csv_file:
            self.stderr.write("No CSV file found in the dataset.")
            return

        self.stdout.write(f"Loading data from {csv_file}...")
        # Load only a subset to save space and time (for simulation)
        try:
            df = pd.read_csv(csv_file, nrows=2000)
            
            # EEG channels: Fp1, Fp2, F7, F3, Fz, F4, F8, T3, C3, Cz, C4, T4, T5, P3, Pz, P4
            # We want to keep samples for each status (0, 1, 2 etc.)
            processed_data = df.to_dict(orient='records')
            
            data_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), '../../data'))
            os.makedirs(data_dir, exist_ok=True)
            
            output_path = os.path.join(data_dir, 'eeg_samples.json')
            with open(output_path, 'w') as f:
                json.dump(processed_data, f)
                
            self.stdout.write(self.style.SUCCESS(f"Successfully imported {len(processed_data)} EEG samples to {output_path}"))
        except Exception as e:
            self.stderr.write(f"Error processing CSV: {e}")
