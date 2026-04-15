from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0003_diagnosisreport'),
    ]

    operations = [
        # Medical History additions
        migrations.AddField(
            model_name='patient',
            name='alcohol_use',
            field=models.BooleanField(default=False),
        ),
        # Cognitive Symptoms
        migrations.AddField(
            model_name='patient',
            name='memory_complaints',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='patient',
            name='language_difficulties',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='patient',
            name='orientation_problems',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='patient',
            name='mood_behavioral_changes',
            field=models.BooleanField(default=False),
        ),
        # Lifestyle
        migrations.AddField(
            model_name='patient',
            name='physical_activity',
            field=models.CharField(
                choices=[('None', 'None'), ('Low', 'Low'), ('Moderate', 'Moderate'), ('High', 'High')],
                default='Low',
                max_length=10,
            ),
        ),
        # Media Files
        migrations.AddField(
            model_name='patient',
            name='voice_recording',
            field=models.FileField(blank=True, null=True, upload_to='recordings/voice/'),
        ),
        migrations.AddField(
            model_name='patient',
            name='face_video',
            field=models.FileField(blank=True, null=True, upload_to='recordings/face/'),
        ),
        migrations.AddField(
            model_name='patient',
            name='eeg_file',
            field=models.FileField(blank=True, null=True, upload_to='medical/eeg/'),
        ),
        migrations.AddField(
            model_name='patient',
            name='mri_file',
            field=models.FileField(blank=True, null=True, upload_to='medical/mri/'),
        ),
    ]
