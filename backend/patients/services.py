import json
import os
import random
from .models import DiagnosisReport

class DiagnosisService:
    @staticmethod
    def get_diagnosis(patient):
        """
        Simulates an AI diagnosis based on patient data.
        Maps age, medical markers, and clinical scores to a risk status.
        """
        # Load EEG samples for visualization
        data_path = os.path.join(os.path.dirname(__file__), 'data/eeg_samples.json')
        samples = []
        if os.path.exists(data_path):
            try:
                with open(data_path, 'r') as f:
                    samples = json.load(f)
            except:
                samples = []

        # Simple Logic for Simulation: 
        score = 0
        if patient.age > 75: score += 40
        elif patient.age > 65: score += 20
        
        if patient.hypertension: score += 15
        if patient.diabetes: score += 15
        if patient.history_of_stroke: score += 20
        if patient.family_history_of_alzheimers: score += 25
        if patient.depression: score += 10
        
        # clinical scores (MMSE is 0-30, lower is worse)
        if patient.mmse_score:
            if patient.mmse_score < 20: score += 40
            elif patient.mmse_score < 24: score += 20
            
        risk_percentage = min(score + random.randint(-5, 5), 98)
        risk_percentage = max(risk_percentage, 2)
        
        if risk_percentage > 70:
            status = "AD (Alzheimer's Disease)"
            target_status_code = 2
        elif risk_percentage > 35:
            status = "MCI (Mild Cognitive Impairment)"
            target_status_code = 1
        else:
            status = "Normal"
            target_status_code = 0
            
        # Select matching EEG data from samples (take 50 time points for the wave visualization)
        eeg_sample = []
        if samples:
            # Filter samples by status (0, 1, 2)
            # The dataset might use different codes, but assuming 0=Normal, 1=MCI, 2=AD for this simulation
            filtered_samples = [s for s in samples if s.get('status') == target_status_code]
            if not filtered_samples:
                filtered_samples = samples
            
            # Select a random starting point and take 50 contiguous points if possible, or just random
            # For visualization, we'll take 50 random samples and sort them to simulate a wave
            eeg_sample = random.sample(filtered_samples, min(50, len(filtered_samples)))
        
        recommendations = DiagnosisService.get_recommendations(status)
        
        # Save to DB
        report = DiagnosisReport.objects.create(
            patient=patient,
            risk_percentage=risk_percentage,
            predicted_status=status,
            eeg_data_json=eeg_sample,
            recommendations=recommendations
        )
        
        return report

    @staticmethod
    def get_recommendations(status):
        if "AD" in status:
            return "Zudlik bilan nevrolog ko'rigidan o'ting. Kundalik turmush tarzini nazorat qilish uchun parvarishlovchi bilan maslahatlashing."
        elif "MCI" in status:
            return "Kognitiv mashqlar (puzzle, mutolaa) bilan shug'ullaning. Sog'lom uyqu va parhezga amal qiling. 6 oydan so'ng qayta tekshiruvdan o'ting."
        else:
            return "Sizda kognitiv pasayish xavfi juda past. Sog'lom turmush tarzini davom ettiring va muntazam ravishda kognitiv testlarni topshirib turing."
