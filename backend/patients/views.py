import io
import logging

from rest_framework import viewsets, mixins, permissions, status as http_status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, action
from django.db import transaction
from django.http import HttpResponse
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from dj_rest_auth.registration.views import SocialLoginView

from .models import Patient, DiagnosisReport
from .serializers import PatientSerializer, DiagnosisReportSerializer
from . import services
from .tasks import run_full_analysis

logger = logging.getLogger(__name__)


class GoogleLogin(SocialLoginView):
    permission_classes = [permissions.AllowAny]
    adapter_class = GoogleOAuth2Adapter


class PatientViewSet(mixins.CreateModelMixin,
                     mixins.ListModelMixin,
                     mixins.RetrieveModelMixin,
                     viewsets.GenericViewSet):
    serializer_class = PatientSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Patient.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        # Persist the assessment + a pending report, then kick off async analysis
        # once the row is actually committed (so the worker never reads too early).
        with transaction.atomic():
            patient = serializer.save(user=self.request.user)
            report = services.create_pending_report(patient)
        transaction.on_commit(lambda: run_full_analysis.delay(report.id))

    @action(detail=True, methods=['get'])
    def report(self, request, pk=None):
        """Poll the (possibly still-processing) multimodal report for an assessment."""
        patient = self.get_object()  # ownership enforced by get_queryset
        report = DiagnosisReport.objects.filter(patient=patient).first()
        if report is None:
            with transaction.atomic():
                report = services.create_pending_report(patient)
            transaction.on_commit(lambda: run_full_analysis.delay(report.id))
        return Response(DiagnosisReportSerializer(report).data)


@api_view(['POST', 'GET'])
@permission_classes([permissions.IsAuthenticated])
def diagnose_patient(request):
    """Return the multimodal report for an assessment (idempotent, async-aware).

    Targets the assessment given by ``patient`` in the body/query, or the user's
    most recent assessment. Creates a pending report and enqueues analysis if
    none exists yet; otherwise returns the current state for polling.
    """
    patient_id = (request.data.get('patient', request.data.get('patient_id'))
                  if request.method == 'POST' else request.GET.get('patient'))
    queryset = Patient.objects.filter(user=request.user)

    if patient_id not in (None, '', 'null'):
        patient = queryset.filter(pk=patient_id).first()
        if patient is None:
            return Response({"detail": "Selected assessment was not found."},
                            status=http_status.HTTP_404_NOT_FOUND)
    else:
        patient = queryset.order_by('-created_at').first()
        if patient is None:
            return Response({"detail": "No assessment found. Please complete the questionnaire first."},
                            status=http_status.HTTP_404_NOT_FOUND)

    report = DiagnosisReport.objects.filter(patient=patient).first()
    if report is None:
        with transaction.atomic():
            report = services.create_pending_report(patient)
        transaction.on_commit(lambda: run_full_analysis.delay(report.id))

    return Response(DiagnosisReportSerializer(report).data, status=http_status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def download_sample_eeg(request):
    """Generate a synthetic EEG CSV the user can upload to try the pipeline.

    ?cls=normal|mci|ad  (default ad). 19 channels, 256 Hz, ~20 s, unlabeled.
    """
    from .analysis.eeg_synth import generate_dataframe

    cls = (request.GET.get('cls', 'ad') or 'ad').lower()
    code = {"normal": 0, "hc": 0, "mci": 1, "ftd": 1, "ad": 2}.get(cls, 2)
    df = generate_dataframe(code, n_seconds=20, fs=256, seed=1000 + code, with_label=False)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    response = HttpResponse(buf.getvalue(), content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="sample_eeg_{cls}.csv"'
    return response
