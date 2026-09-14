from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('cameras', views.CameraViewSet)
router.register('zones', views.ZoneViewSet)
router.register('detections', views.DetectionEventViewSet)
router.register('alerts', views.AlertViewSet)

urlpatterns = [
    path('health/', views.health_view),
    path('auth/login/', views.login_view),
    path('auth/logout/', views.logout_view),
    path('dashboard/summary/', views.dashboard_summary),
    path('alerts/<int:pk>/set-status/', views.set_alert_status),
    path('alerts/<int:pk>/verify-integrity/', views.verify_alert_integrity),
    path('alerts/<int:pk>/incident-report/', views.incident_report),
    path('dashboard/analytics/', views.analytics_summary),
    path('cameras/<str:camera_id>/heartbeat/', views.camera_heartbeat),
    path('cameras/<str:camera_id>/stream/', views.camera_stream, name='camera_stream'),
    path('', include(router.urls)),
]
