from django.contrib import admin
from .models import Camera, Zone, DetectionEvent, Alert

@admin.register(Camera)
class CameraAdmin(admin.ModelAdmin):
    list_display = ('camera_id', 'location', 'sector', 'status', 'ai_active', 'fps')
    list_filter = ('status', 'sector', 'ai_active')

@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ('name', 'camera', 'severity', 'is_active')
    list_filter = ('severity', 'is_active')

@admin.register(DetectionEvent)
class DetectionEventAdmin(admin.ModelAdmin):
    list_display = ('camera', 'object_type', 'confidence', 'zone', 'timestamp')
    list_filter = ('object_type', 'camera')

@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ('id', 'camera', 'event_type', 'severity', 'status', 'created_at')
    list_filter = ('severity', 'status', 'camera')
