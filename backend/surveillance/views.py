from datetime import timedelta
import hashlib
import json
import os

import cv2

from django.conf import settings
from django.http import StreamingHttpResponse, JsonResponse, HttpResponse
from django.utils import timezone
from django.db.models import Count, Avg, Max

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from .models import Camera, Zone, DetectionEvent, Alert
from .serializers import (
    CameraSerializer,
    ZoneSerializer,
    DetectionEventSerializer,
    AlertSerializer,
)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health_view(request):
    return Response({
        'status': 'ok',
        'service': 'borderguard-backend'
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')

    user = authenticate(
        username=username,
        password=password
    )

    if user is None:
        return Response(
            {'detail': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    token, _ = Token.objects.get_or_create(user=user)

    return Response({
        'token': token.key,
        'username': user.username
    })


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

    def get_queryset(self):
        qs = super().get_queryset().select_related('camera')

        camera_id = (
            self.request.query_params.get('camera__camera_id')
            or self.request.query_params.get('camera')
        )

        if camera_id:
            qs = qs.filter(
                camera__camera_id=camera_id
            )

        active = self.request.query_params.get(
            'is_active'
        )

        if active is not None:
            qs = qs.filter(
                is_active=active.lower()
                in ('1', 'true', 'yes')
            )

        return qs


class DetectionEventViewSet(viewsets.ModelViewSet):
    queryset = DetectionEvent.objects.all()
    serializer_class = DetectionEventSerializer
    http_method_names = ['get', 'post', 'head']

    def get_queryset(self):
        qs = super().get_queryset().select_related(
            'camera',
            'zone'
        )

        camera = self.request.query_params.get('camera')
        object_type = self.request.query_params.get(
            'object_type'
        )

        if camera:
            qs = qs.filter(
                camera__camera_id=camera
            )

        if object_type:
            qs = qs.filter(
                object_type=object_type
            )

        return qs


class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.all()
    serializer_class = AlertSerializer

    def perform_create(self, serializer):
        alert = serializer.save()

        cutoff = (
            timezone.now()
            - timedelta(seconds=60)
        )

        peers = (
            Alert.objects
            .filter(created_at__gte=cutoff)
            .exclude(pk=alert.pk)
            .exclude(camera=alert.camera)
        )

        if peers.exists() and alert.risk_score >= 60:
            correlation_id = (
                f"CORR-{alert.created_at.strftime('%Y%m%d%H%M%S')}"
                f"-{alert.camera.camera_id}"
            )

            count = peers.count() + 1

            alert.correlation_id = correlation_id
            alert.correlated_alert_count = count

            alert.risk_score = min(
                100,
                alert.risk_score
                + min(15, (count - 1) * 5)
            )

            if alert.risk_score >= 80:
                alert.risk_level = 'HIGH RISK'
                alert.severity = 'CRITICAL'

            alert.risk_factors = (
                list(alert.risk_factors or [])
                + [
                    f"cross-camera temporal correlation +"
                    f"{min(15, (count - 1) * 5)}"
                ]
            )

            alert.reasoning = (
                '; '.join(alert.risk_factors)[:500]
            )

        self._seal_evidence(alert)

    @staticmethod
    def _file_sha256(field_file):
        if not field_file:
            return ''

        digest = hashlib.sha256()

        field_file.open('rb')

        try:
            for chunk in iter(
                lambda: field_file.read(1024 * 1024),
                b''
            ):
                digest.update(chunk)
        finally:
            field_file.close()

        return digest.hexdigest()

    def _seal_evidence(self, alert):
        evidence_hash = self._file_sha256(
            alert.evidence_image
        )

        previous = (
            Alert.objects
            .filter(
                created_at__lt=alert.created_at
            )
            .exclude(pk=alert.pk)
            .exclude(chain_hash='')
            .order_by('-created_at')
            .values_list(
                'chain_hash',
                flat=True
            )
            .first()
            or ''
        )

        payload = {
            'alert_id': alert.pk,
            'camera': alert.camera.camera_id,
            'event_type': alert.event_type,
            'created_at': alert.created_at.isoformat(),
            'risk_score': alert.risk_score,
            'evidence_sha256': evidence_hash,
            'previous_evidence_hash': previous,
        }

        chain = hashlib.sha256(
            json.dumps(
                payload,
                sort_keys=True,
                separators=(',', ':')
            ).encode()
        ).hexdigest()

        alert.evidence_sha256 = evidence_hash
        alert.previous_evidence_hash = previous
        alert.chain_hash = chain

        alert.save(
            update_fields=[
                'correlation_id',
                'correlated_alert_count',
                'risk_score',
                'risk_level',
                'severity',
                'risk_factors',
                'reasoning',
                'evidence_sha256',
                'previous_evidence_hash',
                'chain_hash',
            ]
        )

    def get_queryset(self):
        qs = super().get_queryset().select_related(
            'camera',
            'zone'
        )

        severity = self.request.query_params.get(
            'severity'
        )

        status_ = self.request.query_params.get(
            'status'
        )

        camera = self.request.query_params.get(
            'camera'
        )

        if severity:
            qs = qs.filter(
                severity=severity
            )

        if status_:
            qs = qs.filter(
                status=status_
            )

        if camera:
            qs = qs.filter(
                camera__camera_id=camera
            )

        return qs


@api_view(['POST'])
def camera_heartbeat(request, camera_id):
    """Record AI-engine liveness and latest measured FPS."""

    try:
        camera = Camera.objects.get(
            camera_id=camera_id
        )
    except Camera.DoesNotExist:
        return Response(
            {'detail': 'Camera not found'},
            status=404
        )

    fps = request.data.get('fps')

    if fps is not None:
        try:
            camera.fps = max(
                0.0,
                float(fps)
            )
        except (TypeError, ValueError):
            return Response(
                {'detail': 'fps must be numeric'},
                status=400
            )

    camera.status = 'ONLINE'
    camera.ai_active = True
    camera.last_activity = timezone.now()

    source_type = request.data.get(
        'source_type'
    )

    if source_type in dict(
        Camera.SOURCE_CHOICES
    ):
        camera.source_type = source_type

    camera.save(
        update_fields=[
            'fps',
            'status',
            'ai_active',
            'last_activity',
            'source_type',
        ]
    )

    return Response(
        CameraSerializer(camera).data
    )


@api_view(['POST'])
def set_alert_status(request, pk):
    try:
        alert = Alert.objects.get(pk=pk)
    except Alert.DoesNotExist:
        return Response(
            {'detail': 'Not found'},
            status=404
        )

    new_status = request.data.get(
        'status'
    )

    if new_status not in dict(
        Alert.STATUS_CHOICES
    ):
        return Response(
            {'detail': 'Invalid status'},
            status=400
        )

    alert.status = new_status

    if 'analyst_notes' in request.data:
        alert.analyst_notes = str(
            request.data.get(
                'analyst_notes'
            ) or ''
        )[:5000]

    if new_status == 'Resolved':
        alert.resolved_at = timezone.now()
        alert.resolved_by = (
            request.user.username
        )

    elif new_status != 'Resolved':
        alert.resolved_at = None
        alert.resolved_by = ''

    alert.save()

    return Response(
        AlertSerializer(alert).data
    )


@api_view(['GET'])
def incident_report(request, pk):
    try:
        alert = (
            Alert.objects
            .select_related(
                'camera',
                'zone'
            )
            .get(pk=pk)
        )
    except Alert.DoesNotExist:
        return Response(
            {'detail': 'Not found'},
            status=404
        )

    response = HttpResponse(
        content_type='application/pdf'
    )

    response['Content-Disposition'] = (
        f'attachment; '
        f'filename="BorderGuard_Incident_AL-{alert.id}.pdf"'
    )

    pdf = canvas.Canvas(
        response,
        pagesize=A4
    )

    width, height = A4
    y = height - 50

    def write_line(
        text,
        size=10,
        gap=16
    ):
        nonlocal y

        if y < 50:
            pdf.showPage()
            y = height - 50

        pdf.setFont(
            'Helvetica',
            size
        )

        pdf.drawString(
            50,
            y,
            str(text)[:110]
        )

        y -= gap

    pdf.setTitle(
        f'BorderGuard AI Incident Report — AL-{alert.id}'
    )

    write_line(
        'BORDERGUARD AI — INCIDENT REPORT',
        size=16,
        gap=24
    )

    write_line(
        f'Alert ID: AL-{alert.id}',
        size=11
    )

    write_line(
        'Generated: '
        f'{timezone.now().strftime("%Y-%m-%d %H:%M:%S")}'
    )

    y -= 8

    write_line(
        'INCIDENT DETAILS',
        size=13,
        gap=20
    )

    write_line(
        f'Camera: {alert.camera.camera_id}'
    )

    write_line(
        f'Location: {alert.camera.location}'
    )

    write_line(
        f'Sector: {alert.camera.sector}'
    )

    write_line(
        f'Zone: '
        f'{alert.zone.name if alert.zone else "None"}'
    )

    write_line(
        f'Event: {alert.event_type}'
    )

    write_line(
        f'Object: {alert.object_type}'
    )

    write_line(
        f'Confidence: {alert.confidence}'
    )

    write_line(
        f'Severity: {alert.severity}'
    )

    write_line(
        f'Risk Score: {alert.risk_score}/100'
    )

    write_line(
        f'Risk Level: {alert.risk_level}'
    )

    write_line(
        f'Status: {alert.status}'
    )

    write_line(
        f'Track ID: {alert.track_id}'
    )

    write_line(
        f'Dwell: {alert.dwell_seconds}s'
    )

    write_line(
        f'Movement Speed: '
        f'{alert.movement_speed} px/s'
    )

    y -= 8

    write_line(
        'CORRELATION',
        size=13,
        gap=20
    )

    write_line(
        f'Correlation ID: '
        f'{alert.correlation_id or "None"}'
    )

    write_line(
        f'Correlated Alerts: '
        f'{alert.correlated_alert_count}'
    )

    y -= 8

    write_line(
        'AI REASONING',
        size=13,
        gap=20
    )

    reasoning = (
        alert.reasoning
        or 'No reasoning recorded.'
    )

    for chunk in [
        reasoning[i:i + 100]
        for i in range(
            0,
            len(reasoning),
            100
        )
    ]:
        write_line(
            chunk,
            size=9,
            gap=14
        )

    y -= 8

    write_line(
        'RISK FACTORS',
        size=13,
        gap=20
    )

    factors = alert.risk_factors or []

    if isinstance(factors, list):
        for factor in factors:
            write_line(
                f'- {factor}',
                size=9,
                gap=14
            )
    else:
        write_line(
            str(factors),
            size=9,
            gap=14
        )

    y -= 8

    write_line(
        'EVIDENCE INTEGRITY',
        size=13,
        gap=20
    )

    write_line(
        f'Evidence SHA-256: '
        f'{alert.evidence_sha256 or "None"}',
        size=8,
        gap=14
    )

    write_line(
        f'Previous Hash: '
        f'{alert.previous_evidence_hash or "None"}',
        size=8,
        gap=14
    )

    write_line(
        f'Chain Hash: '
        f'{alert.chain_hash or "None"}',
        size=8,
        gap=14
    )

    y -= 8

    write_line(
        'ANALYST NOTES',
        size=13,
        gap=20
    )

    notes = (
        alert.analyst_notes
        or 'No analyst notes recorded.'
    )

    for chunk in [
        notes[i:i + 100]
        for i in range(
            0,
            len(notes),
            100
        )
    ]:
        write_line(
            chunk,
            size=9,
            gap=14
        )

    y -= 8

    write_line(
        'DISCLAIMER',
        size=13,
        gap=20
    )

    disclaimer = (
        'Prototype operational report based only on '
        'recorded video events and rule-based scoring. '
        'It does not infer identity, intent, or criminality.'
    )

    for chunk in [
        disclaimer[i:i + 100]
        for i in range(
            0,
            len(disclaimer),
            100
        )
    ]:
        write_line(
            chunk,
            size=8,
            gap=13
        )

    pdf.save()

    return response


@api_view(['GET'])
def verify_alert_integrity(request, pk):
    try:
        alert = (
            Alert.objects
            .select_related('camera')
            .get(pk=pk)
        )
    except Alert.DoesNotExist:
        return Response(
            {'detail': 'Not found'},
            status=404
        )

    evidence_hash = (
        AlertViewSet._file_sha256(
            alert.evidence_image
        )
    )

    payload = {
        'alert_id': alert.pk,
        'camera': alert.camera.camera_id,
        'event_type': alert.event_type,
        'created_at': alert.created_at.isoformat(),
        'risk_score': alert.risk_score,
        'evidence_sha256': evidence_hash,
        'previous_evidence_hash':
            alert.previous_evidence_hash,
    }

    expected_chain = hashlib.sha256(
        json.dumps(
            payload,
            sort_keys=True,
            separators=(',', ':')
        ).encode()
    ).hexdigest()

    evidence_ok = (
        not alert.evidence_sha256
        or evidence_hash
        == alert.evidence_sha256
    )

    chain_ok = (
        not alert.chain_hash
        or expected_chain
        == alert.chain_hash
    )

    previous = (
        Alert.objects
        .filter(
            created_at__lt=alert.created_at
        )
        .exclude(pk=alert.pk)
        .exclude(chain_hash='')
        .order_by('-created_at')
        .values_list(
            'chain_hash',
            flat=True
        )
        .first()
        or ''
    )

    link_ok = (
        alert.previous_evidence_hash
        == previous
    )

    return Response({
        'alert_id': alert.id,
        'verified':
            evidence_ok
            and chain_ok
            and link_ok,
        'evidence_hash_match':
            evidence_ok,
        'chain_hash_match':
            chain_ok,
        'previous_link_match':
            link_ok,
        'evidence_sha256':
            evidence_hash,
        'stored_evidence_sha256':
            alert.evidence_sha256,
        'chain_hash':
            alert.chain_hash,
        'previous_evidence_hash':
            alert.previous_evidence_hash,
    })


@api_view(['GET'])
def analytics_summary(request):
    today = timezone.now().date()
    since = (
        timezone.now()
        - timedelta(hours=24)
    )

    events = DetectionEvent.objects.filter(
        timestamp__gte=since
    )

    alerts = Alert.objects.filter(
        created_at__gte=since
    )

    hourly = []

    for offset in range(23, -1, -1):
        start = (
            timezone.now()
            - timedelta(hours=offset + 1)
        )

        end = (
            timezone.now()
            - timedelta(hours=offset)
        )

        hourly.append({
            'hour': end.strftime('%H:00'),

            'detections': events.filter(
                timestamp__gte=start,
                timestamp__lt=end
            ).count(),

            'alerts': alerts.filter(
                created_at__gte=start,
                created_at__lt=end
            ).count(),
        })

    return Response({
        'period': '24h',

        'events_today': DetectionEvent.objects.filter(
            timestamp__date=today
        ).count(),

        'detections_24h': events.count(),

        'alerts_24h': alerts.count(),

        'average_risk': round(
            alerts.aggregate(
                v=Avg('risk_score')
            )['v'] or 0,
            1
        ),

        'peak_risk': alerts.aggregate(
            v=Max('risk_score')
        )['v'] or 0,

        'risk_levels': list(
            alerts
            .values('risk_level')
            .annotate(count=Count('id'))
            .order_by('-count')
        ),

        'event_types': list(
            alerts
            .values('event_type')
            .annotate(count=Count('id'))
            .order_by('-count')
        ),

        'hourly': hourly,

        'zone_violations': alerts.filter(
            event_type='RESTRICTED_ZONE_INTRUSION'
        ).count(),

        'resolved': alerts.filter(
            status='Resolved'
        ).count(),
    })


@api_view(['GET'])
def dashboard_summary(request):
    cameras = Camera.objects.all()
    alerts = Alert.objects.all()
    today = timezone.now().date()

    data = {
        'total_cameras':
            cameras.count(),

        'online_cameras':
            cameras.filter(
                status='ONLINE'
            ).count(),

        'active_alerts':
            alerts.exclude(
                status='Resolved'
            ).count(),

        'events_today':
            DetectionEvent.objects.filter(
                timestamp__date=today
            ).count(),

        'critical_alerts':
            alerts.filter(
                severity='CRITICAL'
            ).exclude(
                status='Resolved'
            ).count(),

        'average_risk': round(
            alerts
            .filter(
                created_at__date=today
            )
            .aggregate(
                v=Avg('risk_score')
            )['v'] or 0,
            1
        ),

        'high_risk_alerts':
            alerts.filter(
                risk_level='HIGH RISK'
            ).exclude(
                status='Resolved'
            ).count(),

        'ai_engine_status': (
            'ONLINE'
            if cameras.filter(
                ai_active=True
            ).exists()
            else 'IDLE'
        ),

        'severity_breakdown':
            list(
                alerts
                .values('severity')
                .annotate(
                    count=Count('id')
                )
            ),

        'events_by_camera':
            list(
                DetectionEvent.objects
                .values(
                    'camera__camera_id'
                )
                .annotate(
                    count=Count('id')
                )
            ),
    }

    return Response(data)


def camera_stream(request, camera_id):
    """
    Stream the configured camera source as MJPEG
    for browser viewing.
    """

    try:
        camera = Camera.objects.get(
            camera_id=camera_id
        )
    except Camera.DoesNotExist:
        return JsonResponse(
            {'detail': 'Camera not found'},
            status=404
        )

    source = camera.source_path

    if not source:
        return JsonResponse(
            {
                'detail':
                    'Camera source is not configured'
            },
            status=400
        )

    if not os.path.isabs(source):
        project_root = settings.BASE_DIR.parent

        project_path = os.path.join(
            project_root,
            source
        )

        media_path = os.path.join(
            settings.MEDIA_ROOT,
            source
        )

        if os.path.exists(project_path):
            source = project_path

        elif os.path.exists(media_path):
            source = media_path

    capture = cv2.VideoCapture(source)

    if not capture.isOpened():
        return JsonResponse(
            {
                'detail':
                    'Unable to open camera source',
                'source': source,
            },
            status=503
        )

    def generate():
        try:
            while True:
                success, frame = capture.read()

                if not success:
                    break

                success, buffer = cv2.imencode(
                    '.jpg',
                    frame
                )

                if not success:
                    continue

                yield (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n'
                    + buffer.tobytes()
                    + b'\r\n'
                )

        finally:
            capture.release()

    return StreamingHttpResponse(
        generate(),
        content_type=(
            'multipart/x-mixed-replace; '
            'boundary=frame'
        )
    )