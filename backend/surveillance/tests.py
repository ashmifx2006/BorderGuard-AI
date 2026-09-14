from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Camera, Zone, DetectionEvent, Alert


class PhaseOneIntegrationTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="phase1", password="test-password"
        )
        self.client.force_authenticate(self.user)
        self.camera = Camera.objects.create(
            camera_id="CAM-01",
            location="Sector A - North Fence",
            sector="A",
        )
        self.other_camera = Camera.objects.create(
            camera_id="CAM-02",
            location="Sector A - Gate 2",
            sector="A",
        )
        self.zone = Zone.objects.create(
            name="Restricted Zone A",
            camera=self.camera,
            severity="CRITICAL",
            polygon=[[0.35, 0.2], [0.75, 0.2], [0.75, 0.8], [0.35, 0.8]],
        )

    def test_zone_filter_accepts_ai_camera_query(self):
        response = self.client.get("/api/zones/?camera__camera_id=CAM-01")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["camera_display"], "CAM-01")

    def test_detection_create_accepts_camera_id(self):
        response = self.client.post(
            "/api/detections/",
            {
                "camera": "CAM-01",
                "object_type": "person",
                "confidence": 0.93,
                "bbox": [100, 100, 200, 300],
                "zone": self.zone.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["camera_display"], "CAM-01")
        self.assertEqual(DetectionEvent.objects.count(), 1)

    def test_heartbeat_marks_camera_online(self):
        response = self.client.post(
            "/api/cameras/CAM-01/heartbeat/",
            {"fps": 24.7, "source_type": "UPLOAD"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.camera.refresh_from_db()
        self.assertEqual(self.camera.status, "ONLINE")
        self.assertTrue(self.camera.ai_active)
        self.assertAlmostEqual(self.camera.fps, 24.7)
        self.assertIsNotNone(self.camera.last_activity)


class PhaseFourEvidenceTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='phase4', password='test-password')
        self.client.force_authenticate(self.user)
        self.camera = Camera.objects.create(camera_id='CAM-04', location='Sector B - Service Gate', sector='B')

    def test_alert_status_persists_notes(self):
        alert = Alert.objects.create(camera=self.camera, event_type='UNUSUAL_MOVEMENT', object_type='person', severity='MEDIUM', confidence=.91, risk_score=44, risk_level='SUSPICIOUS', risk_factors=['movement speed'], reasoning='movement speed')
        response = self.client.post(f'/api/alerts/{alert.id}/set-status/', {'status':'Investigating','analyst_notes':'Officer verified movement on camera.'}, format='json')
        self.assertEqual(response.status_code, 200)
        alert.refresh_from_db()
        self.assertEqual(alert.status, 'Investigating')
        self.assertIn('Officer verified', alert.analyst_notes)

    def test_incident_report_endpoint(self):
        alert = Alert.objects.create(camera=self.camera, event_type='RESTRICTED_ZONE_INTRUSION', object_type='person', severity='HIGH', confidence=.95, risk_score=72, risk_level='HIGH RISK', risk_factors=['restricted zone'], reasoning='restricted zone')
        response = self.client.get(f'/api/alerts/{alert.id}/incident-report/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['incident']['risk_score'], 72)
        self.assertEqual(response.data['incident']['camera'], 'CAM-04')
