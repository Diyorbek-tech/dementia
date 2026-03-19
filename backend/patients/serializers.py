from rest_framework import serializers
from .models import Patient

class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = '__all__'
        read_only_fields = ['user']

    def validate_age(self, value):
        if value <= 0:
            raise serializers.ValidationError("Age must be a positive number.")
        return value

    def validate_mmse_score(self, value):
        if value is not None and (value < 0 or value > 30):
            raise serializers.ValidationError("MMSE score must be between 0 and 30.")
        return value

    def validate_moca_score(self, value):
        if value is not None and (value < 0 or value > 30):
            raise serializers.ValidationError("MoCA score must be between 0 and 30.")
        return value
