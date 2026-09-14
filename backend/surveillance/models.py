from django.db import models


class Camera(models.Model):
    STATUS_CHOICES = [
        ('ONLINE', 'Online'),
        ('OFFLINE', 'Offline'),
        ('WARNING', 'Warning'),
        ('MAINTENANCE', 'Maintenance'),
    ]
    SOURCE_CHOICES = [
        ('UPLOAD', 'Uploaded Video'),
        ('WEBCAM', 'Webcam'),
        ('RTSP', 'RTSP / IP Camera'),
    ]

    camera_id = models.CharField(max_length=20, unique=True)  # e.g. CAM-01
    location = models.CharField(max_length=120)
    sector = models.CharField(max_length=10, default='A')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OFFLINE')
    source_type = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='UPLOAD')
    source_path = models.CharField(max_length=255, blank=True, help_text='File path, webcam index, or RTSP URL')
    ai_active = models.BooleanField(default=False)
    fps = models.FloatField(default=0)
    last_activity = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.camera_id} — {self.location}"


class Zone(models.Model):
    SEVERITY_CHOICES = [
        ('CRITICAL', 'Critical'),
        ('HIGH', 'High'),
        ('MEDIUM', 'Medium'),
        ('LOW', 'Low'),
    ]

    name = models.CharField(max_length=120)
    camera = models.ForeignKey(Camera, on_delete=models.CASCADE, related_name='zones')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='HIGH')
    # Polygon stored as a JSON list of [x, y] points normalized 0-1 relative to frame size
    polygon = models.JSONField(default=list)
    active_hours = models.CharField(max_length=40, default='24x7')
    alert_threshold = models.CharField(max_length=80, default='1 person')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.camera.camera_id})"


class DetectionEvent(models.Model):
    """Raw detection log written continuously by the AI engine."""
    OBJECT_CHOICES = [('person', 'Person'), ('vehicle', 'Vehicle')]

    camera = models.ForeignKey(Camera, on_delete=models.CASCADE, related_name='detections')
    object_type = models.CharField(max_length=20, choices=OBJECT_CHOICES)
    confidence = models.FloatField()
    bbox = models.JSONField(help_text='[x1, y1, x2, y2] pixel coordinates')
    zone = models.ForeignKey(Zone, on_delete=models.SET_NULL, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.object_type} @ {self.camera.camera_id} ({self.confidence:.2f})"


class Alert(models.Model):
    SEVERITY_CHOICES = [
        ('CRITICAL', 'Critical'),
        ('HIGH', 'High'),
        ('MEDIUM', 'Medium'),
        ('LOW', 'Low'),
    ]
    STATUS_CHOICES = [
        ('New', 'New'),
        ('Acknowledged', 'Acknowledged'),
        ('Investigating', 'Investigating'),
        ('Resolved', 'Resolved'),
    ]
    EVENT_CHOICES = [
        ('RESTRICTED_ZONE_INTRUSION', 'Restricted-zone intrusion'),
        ('PROLONGED_PRESENCE', 'Prolonged presence detected'),
        ('UNUSUAL_MOVEMENT', 'Unusual movement'),
        ('COMPOUND_INCIDENT', 'Compound incident'),
        ('NORMAL_DETECTION', 'Normal object detection'),
    ]

    camera = models.ForeignKey(Camera, on_delete=models.CASCADE, related_name='alerts')
    zone = models.ForeignKey(Zone, on_delete=models.SET_NULL, null=True, blank=True)
    event_type = models.CharField(max_length=40, choices=EVENT_CHOICES)
    object_type = models.CharField(max_length=20, default='person')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    confidence = models.FloatField()
    event_score = models.IntegerField(default=1, help_text='1-10 legacy priority score')
    risk_score = models.IntegerField(default=0, help_text='0-100 contextual rule-based risk score')
    risk_level = models.CharField(max_length=20, default='NORMAL')
    risk_factors = models.JSONField(default=list, blank=True)
    track_id = models.CharField(max_length=40, blank=True)
    dwell_seconds = models.FloatField(default=0)
    movement_speed = models.FloatField(default=0)
    correlation_id = models.CharField(max_length=80, blank=True)
    correlated_alert_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='New')
    evidence_image = models.ImageField(upload_to='evidence/', null=True, blank=True)
    evidence_sha256 = models.CharField(max_length=64, blank=True)
    previous_evidence_hash = models.CharField(max_length=64, blank=True)
    chain_hash = models.CharField(max_length=64, blank=True)
    analyst_notes = models.TextField(blank=True)
    reasoning = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.CharField(max_length=80, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.severity}] {self.event_type} — {self.camera.camera_id}"
