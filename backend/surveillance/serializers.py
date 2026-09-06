from rest_framework import serializers

from .models import Camera, Zone, DetectionEvent, Alert


class CameraSerializer(serializers.ModelSerializer):

    class Meta:
        model = Camera
        fields = '__all__'


class ZoneSerializer(serializers.ModelSerializer):

    camera_display = serializers.CharField(
        source='camera.camera_id',
        read_only=True
    )

    class Meta:
        model = Zone
        fields = '__all__'


class DetectionEventSerializer(serializers.ModelSerializer):

    # Accept CAM-01, CAM-02, etc. from the AI engine.
    camera = serializers.SlugRelatedField(
        slug_field='camera_id',
        queryset=Camera.objects.all()
    )

    camera_display = serializers.CharField(
        source='camera.camera_id',
        read_only=True
    )

    class Meta:
        model = DetectionEvent
        fields = '__all__'


class AlertSerializer(serializers.ModelSerializer):

    # Accept CAM-01 instead of Django's numeric camera ID.
    camera = serializers.SlugRelatedField(
        slug_field='camera_id',
        queryset=Camera.objects.all()
    )

    camera_display = serializers.CharField(
        source='camera.camera_id',
        read_only=True
    )

    location = serializers.CharField(
        source='camera.location',
        read_only=True
    )

    zone_display = serializers.CharField(
        source='zone.name',
        read_only=True,
        default=None
    )

    class Meta:
        model = Alert
        fields = '__all__'
        read_only_fields = ('created_at',)