from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PatientViewSet, GoogleLogin

router = DefaultRouter()
router.register(r'patients', PatientViewSet, basename='patient')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/google/', GoogleLogin.as_view(), name='google_login'),
]
