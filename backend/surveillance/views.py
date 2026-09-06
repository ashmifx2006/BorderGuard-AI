from django.utils import timezone
from django.db.models import Count, Q
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate

from .models import Camera, Zone, DetectionEvent, Alert
from .serializers import (
    CameraSerializer, ZoneSerializer, DetectionEventSerializer, AlertSerializer
)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(username=username, password=password)
    if user is None:
        return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'username': user.username})


@api_view(['POST'])
def logout_view(request):
    request.user.auth_token.delete()
    return Response({'detail': 'Logged out'})


class CameraViewSet(viewsets.ModelViewSet):
    queryset = Camera.objects.all()
    serializer_class = CameraSerializer


class ZoneViewSet(viewsets.ModelViewSet):
    queryset = Zone.objects.all()
    serializer_class = ZoneSerializer


class DetectionEventViewSet(viewsets.ModelViewSet):
    queryset = DetectionEvent.objects.all()
    serializer_class = DetectionEventSerializer
    http_method_names = ['get', 'post', 'head']


class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.all()
    serializer_class = AlertSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        severity = self.request.query_params.get('severity')
        status_ = self.request.query_params.get('status')
        camera = self.request.query_params.get('camera')
        if severity:
            qs = qs.filter(severity=severity)
        if status_:
            qs = qs.filter(status=status_)
        if camera:
            qs = qs.filter(camera__camera_id=camera)
        return qs


@api_view(['POST'])
def set_alert_status(request, pk):
    try:
        alert = Alert.objects.get(pk=pk)
    except Alert.DoesNotExist:
        return Response({'detail': 'Not found'}, status=404)
    new_status = request.data.get('status')
    if new_status not in dict(Alert.STATUS_CHOICES):
        return Response({'detail': 'Invalid status'}, status=400)
    alert.status = new_status
    if new_status == 'Resolved':
        alert.resolved_at = timezone.now()
        alert.resolved_by = request.user.username
    alert.save()
    return Response(AlertSerializer(alert).data)


@api_view(['GET'])
def dashboard_summary(request):
    cameras = Camera.objects.all()
    alerts = Alert.objects.all()
    today = timezone.now().date()

    data = {
        'total_cameras': cameras.count(),
        'online_cameras': cameras.filter(status='ONLINE').count(),
        'active_alerts': alerts.exclude(status='Resolved').count(),
        'events_today': DetectionEvent.objects.filter(timestamp__date=today).count(),
        'critical_alerts': alerts.filter(severity='CRITICAL').exclude(status='Resolved').count(),
        'ai_engine_status': 'ONLINE' if cameras.filter(ai_active=True).exists() else 'IDLE',
        'severity_breakdown': list(
            alerts.values('severity').annotate(count=Count('id'))
        ),
        'events_by_camera': list(
            DetectionEvent.objects.values('camera__camera_id').annotate(count=Count('id'))
        ),
    }
    return Response(data)
