from rest_framework import serializers
from .models import Camera, Zone, DetectionEvent, Alert


class CameraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Camera
        fields = '__all__'


class ZoneSerializer(serializers.ModelSerializer):
    camera_display = serializers.CharField(source='camera.camera_id', read_only=True)

    class Meta:
        model = Zone
        fields = '__all__'


class DetectionEventSerializer(serializers.ModelSerializer):
    # The AI engine identifies cameras by stable camera_id values such as CAM-01.
    # Accept that value directly instead of leaking Django's numeric PK into the AI process.
    camera = serializers.SlugRelatedField(
        slug_field='camera_id', queryset=Camera.objects.all()
    )
    camera_display = serializers.CharField(source='camera.camera_id', read_only=True)
    zone_display = serializers.CharField(source='zone.name', read_only=True, default=None)

    class Meta:
        model = DetectionEvent
        fields = '__all__'


class AlertSerializer(serializers.ModelSerializer):
    # Accept the human-readable camera_id (e.g. "CAM-01") from the AI engine
    # instead of requiring its internal numeric primary key.
    camera = serializers.SlugRelatedField(slug_field='camera_id', queryset=Camera.objects.all())
    camera_display = serializers.CharField(source='camera.camera_id', read_only=True)
    location = serializers.CharField(source='camera.location', read_only=True)
    zone_display = serializers.CharField(source='zone.name', read_only=True, default=None)

    class Meta:
        model = Alert
        fields = '__all__'
        read_only_fields = ('created_at', 'correlation_id', 'correlated_alert_count', 'evidence_sha256', 'previous_evidence_hash', 'chain_hash', 'resolved_at', 'resolved_by')
