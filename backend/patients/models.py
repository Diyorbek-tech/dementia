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

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email if self.user else 'anonymous'} - {self.age} - {self.created_at}"


class DiagnosisReport(models.Model):
    """Multimodal cognitive-decline report for a single :class:`Patient` assessment.

    One-to-one with the assessment. Per-modality analysis runs asynchronously in
    a Celery worker, writing each modality's result + the fused outcome here, so
    the frontend can poll ``analysis_status`` and render progressively.
    """

    # ── Predicted status values (kept stable for the frontend) ─────────────────
    NORMAL = "Normal"
    MCI = "MCI (Mild Cognitive Impairment)"
    AD = "AD (Alzheimer's Disease)"
    STATUS_CHOICES = [(NORMAL, NORMAL), (MCI, MCI), (AD, AD)]

    # ── Async analysis lifecycle ───────────────────────────────────────────────
    PENDING, PROCESSING, DONE, PARTIAL, FAILED = "pending", "processing", "done", "partial", "failed"
    ANALYSIS_STATUS_CHOICES = [
        (PENDING, "Pending"), (PROCESSING, "Processing"), (DONE, "Done"),
        (PARTIAL, "Partial"), (FAILED, "Failed"),
    ]

    patient = models.OneToOneField(
        Patient,
        on_delete=models.CASCADE,
        related_name='diagnosis_report',
    )

    analysis_status = models.CharField(
        max_length=20, choices=ANALYSIS_STATUS_CHOICES, default=PENDING,
    )
    modalities_used = models.JSONField(default=list, blank=True)

    # Per-modality results (filled in by the worker as each completes).
    speech_result = models.JSONField(null=True, blank=True)
    face_result = models.JSONField(null=True, blank=True)
    eeg_result = models.JSONField(null=True, blank=True)
    clinical_result = models.JSONField(null=True, blank=True)
    fusion_result = models.JSONField(null=True, blank=True)

    # Fused outcome (populated once fusion runs).
    risk_percentage = models.FloatField(
        null=True, blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(100.0)],
    )
    predicted_status = models.CharField(max_length=50, choices=STATUS_CHOICES, blank=True)
    confidence = models.FloatField(null=True, blank=True)
    recommendations = models.TextField(blank=True)

    # Real EEG waveform preview from the uploaded file (kept for back-compat name).
    eeg_data_json = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        user_email = self.patient.user.email if self.patient.user else 'anonymous'
        return f"Report for {user_email} - {self.predicted_status or self.analysis_status}"
