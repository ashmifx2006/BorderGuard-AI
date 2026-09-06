from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('cameras', views.CameraViewSet)
router.register('zones', views.ZoneViewSet)
router.register('detections', views.DetectionEventViewSet)
router.register('alerts', views.AlertViewSet)

urlpatterns = [
    path('auth/login/', views.login_view),
    path('auth/logout/', views.logout_view),
    path('dashboard/summary/', views.dashboard_summary),
    path('alerts/<int:pk>/set-status/', views.set_alert_status),
    path('', include(router.urls)),
]
