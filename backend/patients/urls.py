from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import PatientViewSet, GoogleLogin, diagnose_patient, download_sample_eeg

router = DefaultRouter()
router.register(r'patients', PatientViewSet, basename='patient')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/google/', GoogleLogin.as_view(), name='google_login'),
    path('auth/jwt/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('diagnose/', diagnose_patient, name='diagnose_patient'),
    path('eeg/sample/', download_sample_eeg, name='download_sample_eeg'),
]
