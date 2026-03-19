from rest_framework import viewsets, mixins, permissions
from rest_framework.response import Response
from .models import Patient
from .serializers import PatientSerializer
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView

class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    callback_url = "http://localhost:3000/api/auth/callback/google"
    client_class = OAuth2Client

class PatientViewSet(mixins.CreateModelMixin,
                     mixins.ListModelMixin,
                     mixins.RetrieveModelMixin,
                     viewsets.GenericViewSet):
    serializer_class = PatientSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Patient.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

from rest_framework.decorators import api_view, permission_classes
from .services import DiagnosisService
from .serializers import DiagnosisReportSerializer

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def diagnose_patient(request):
    try:
        # Get the latest patient profile for the user
        patient = Patient.objects.filter(user=request.user).latest('created_at')
        report = DiagnosisService.get_diagnosis(patient)
        serializer = DiagnosisReportSerializer(report)
        return Response(serializer.data, status=201)
    except Patient.DoesNotExist:
        return Response({"error": "Profil topilmadi. Avval so'rovnomani to'ldiring."}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
