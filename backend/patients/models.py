from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth.models import User

class Patient(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='assessments')

    GENDER_CHOICES = [('M', 'Male'), ('F', 'Female'), ('O', 'Other')]
    EDUCATION_CHOICES = [('None', 'None'), ('Primary', 'Primary'), ('Secondary', 'Secondary'), ('Higher', 'Higher')]
    SMOKING_CHOICES = [('Never', 'Never'), ('Former', 'Former'), ('Current', 'Current')]
    ACTIVITY_CHOICES = [('None', 'None'), ('Low', 'Low'), ('Moderate', 'Moderate'), ('High', 'High')]

    # ── Demographic ────────────────────────────────────────────────────────────
    age = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    education_level = models.CharField(max_length=10, choices=EDUCATION_CHOICES)

    # ── Clinical Scores ────────────────────────────────────────────────────────
    mmse_score = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0), MaxValueValidator(30.0)])
    moca_score = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0), MaxValueValidator(30.0)])

    # ── Medical History ────────────────────────────────────────────────────────
    hypertension = models.BooleanField(default=False)
    diabetes = models.BooleanField(default=False)
    history_of_stroke = models.BooleanField(default=False)
    depression = models.BooleanField(default=False)
    family_history_of_alzheimers = models.BooleanField(default=False)
    alcohol_use = models.BooleanField(default=False)

    # ── Cognitive Symptoms ─────────────────────────────────────────────────────
    memory_complaints = models.BooleanField(default=False)
    language_difficulties = models.BooleanField(default=False)
    orientation_problems = models.BooleanField(default=False)
    mood_behavioral_changes = models.BooleanField(default=False)

    # ── Lifestyle ──────────────────────────────────────────────────────────────
    smoking_status = models.CharField(max_length=10, choices=SMOKING_CHOICES)
    sleep_hours_per_day = models.PositiveIntegerField()
    physical_activity = models.CharField(max_length=10, choices=ACTIVITY_CHOICES, default='Low')

    # ── Media Files ────────────────────────────────────────────────────────────
    voice_recording = models.FileField(upload_to='recordings/voice/', null=True, blank=True)
    face_video = models.FileField(upload_to='recordings/face/', null=True, blank=True)
    eeg_file = models.FileField(upload_to='medical/eeg/', null=True, blank=True)
    mri_file = models.FileField(upload_to='medical/mri/', null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email if self.user else 'anonymous'} - {self.age} - {self.created_at}"


class DiagnosisReport(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='diagnosis_reports')
    risk_percentage = models.FloatField()
    predicted_status = models.CharField(max_length=50)  # Normal, MCI, AD
    eeg_data_json = models.JSONField()
    recommendations = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        user_email = self.patient.user.email if self.patient.user else 'anonymous'
        return f"Report for {user_email} - {self.predicted_status}"
