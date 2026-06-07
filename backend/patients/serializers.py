from rest_framework import serializers
from .models import Patient, DiagnosisReport


class DiagnosisReportSerializer(serializers.ModelSerializer):
    # Compact per-modality summary for trend/monitoring views (avoids the
    # client recomputing it from the verbose per-modality blobs).
    summary = serializers.SerializerMethodField()

    class Meta:
        model = DiagnosisReport
        fields = '__all__'
        read_only_fields = (
            'id', 'patient', 'analysis_status', 'modalities_used',
            'speech_result', 'face_result', 'eeg_result', 'clinical_result',
            'fusion_result', 'risk_percentage', 'predicted_status', 'confidence',
            'recommendations', 'eeg_data_json', 'created_at', 'updated_at',
        )

    def get_summary(self, obj):
        modalities = {}
        for key, result in (
            ('speech', obj.speech_result),
            ('eeg', obj.eeg_result),
            ('face', obj.face_result),
            ('clinical', obj.clinical_result),
        ):
            if isinstance(result, dict) and isinstance(result.get('risk'), (int, float)):
                modalities[key] = result['risk']
        return {
            'analysis_status': obj.analysis_status,
            'overall_risk': obj.risk_percentage,
            'predicted_status': obj.predicted_status,
            'confidence': obj.confidence,
            'modalities': modalities,
            'created_at': obj.created_at,
        }


class PatientSerializer(serializers.ModelSerializer):
    # The (async) report is exposed read-only so the client can poll it.
    diagnosis_report = DiagnosisReportSerializer(read_only=True)

    class Meta:
        model = Patient
        fields = '__all__'
        read_only_fields = ('user', 'created_at', 'diagnosis_report')
