from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth.models import User

class Patient(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='assessments')
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]
    EDUCATION_CHOICES = [
        ('None', 'None'),
        ('Primary', 'Primary'),
        ('Secondary', 'Secondary'),
        ('Higher', 'Higher'),
    ]
    SMOKING_CHOICES = [
        ('Never', 'Never'),
        ('Former', 'Former'),
        ('Current', 'Current'),
    ]

    # Demographic
    age = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    education_level = models.CharField(max_length=10, choices=EDUCATION_CHOICES)

    # Clinical Markers
    mmse_score = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0), MaxValueValidator(30.0)])
    moca_score = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0.0), MaxValueValidator(30.0)])

    # Medical History
    hypertension = models.BooleanField(default=False)
    diabetes = models.BooleanField(default=False)
    history_of_stroke = models.BooleanField(default=False)
    depression = models.BooleanField(default=False)
    family_history_of_alzheimers = models.BooleanField(default=False)

    # Lifestyle
    smoking_status = models.CharField(max_length=10, choices=SMOKING_CHOICES)
    sleep_hours_per_day = models.PositiveIntegerField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Patient {self.id} - Age: {self.age}"
