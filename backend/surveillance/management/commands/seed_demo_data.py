"""
Seeds demo cameras and zones so the dashboard has something to show
the moment you run the server, before any real video is processed.

Usage: python manage.py seed_demo_data
"""
from django.core.management.base import BaseCommand
from surveillance.models import Camera, Zone

LOCATIONS = [
    ("CAM-01", "Sector A - North Fence", "A"),
    ("CAM-02", "Sector A - Gate 2", "A"),
    ("CAM-03", "Sector B - Watchtower", "B"),
    ("CAM-04", "Sector B - Perimeter Road", "B"),
    ("CAM-05", "Sector C - River Crossing", "C"),
    ("CAM-06", "Sector C - Access Road", "C"),
]

class Command(BaseCommand):
    help = "Seed demo cameras and zones"

    def handle(self, *args, **options):
        for cam_id, location, sector in LOCATIONS:
            cam, created = Camera.objects.get_or_create(
                camera_id=cam_id,
                defaults=dict(
                    location=location, sector=sector, status='OFFLINE',
                    source_type='UPLOAD', ai_active=False,
                )
            )
            if created:
                self.stdout.write(f"Created {cam_id}")

        cam01 = Camera.objects.get(camera_id="CAM-01")
        Zone.objects.get_or_create(
            name="Restricted Zone A", camera=cam01,
            defaults=dict(
                severity="CRITICAL",
                polygon=[[0.35, 0.2], [0.75, 0.2], [0.75, 0.8], [0.35, 0.8]],
                active_hours="24x7", alert_threshold="1 person",
            )
        )
        self.stdout.write(self.style.SUCCESS("Demo data seeded."))
