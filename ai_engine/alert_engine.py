"""
alert_engine.py — assigns a transparent, rule-based priority score to
each event and posts the alert (with an evidence frame) to the Django
REST API.

Scoring is intentionally simple and explainable for a hackathon demo —
it does NOT claim to detect criminal intent, only to prioritize
configurable conditions for human review.
"""
import time
import os
import cv2
import requests
from config import BACKEND_API_BASE, BACKEND_AUTH_TOKEN, ALERT_COOLDOWN_SECONDS, EVIDENCE_DIR

SCORE_TABLE = {
    "NORMAL_DETECTION": (1, "LOW", "Object recognized outside any restricted zone"),
    "UNUSUAL_MOVEMENT": (4, "MEDIUM", "Movement pattern flagged by tracking heuristics"),
    "RESTRICTED_ZONE_INTRUSION": (7, "HIGH", "Confirmed presence inside zone boundary"),
    "PROLONGED_PRESENCE": (9, "CRITICAL", "Presence exceeded configured dwell-time threshold"),
}


class AlertEngine:
    def __init__(self):
        self._last_fired = {}  # (track_id, event_type) -> timestamp
        os.makedirs(EVIDENCE_DIR, exist_ok=True)

    def _on_cooldown(self, track_id, event_type):
        key = (track_id, event_type)
        last = self._last_fired.get(key)
        now = time.time()
        if last and (now - last) < ALERT_COOLDOWN_SECONDS:
            return True
        self._last_fired[key] = now
        return False

    def process(self, camera_id, track_id, label, confidence, bbox, event_result, frame):
        event_type = event_result["event_type"]
        if event_type == "NORMAL_DETECTION":
            return None  # don't create alert noise for routine detections
        if self._on_cooldown(track_id, event_type):
            return None

        score, severity, reasoning = SCORE_TABLE[event_type]
        evidence_path = self._save_evidence(camera_id, track_id, frame)
        payload = {
            "camera": camera_id,
            "zone": event_result["zone"]["id"] if event_result.get("zone") else None,
            "event_type": event_type,
            "object_type": label,
            "severity": severity,
            "confidence": confidence,
            "event_score": score,
            "reasoning": reasoning,
        }
        return self._post_alert(payload, evidence_path)

    def _save_evidence(self, camera_id, track_id, frame):
        ts = int(time.time() * 1000)
        filename = f"{camera_id}_{track_id}_{ts}.jpg"
        path = os.path.join(EVIDENCE_DIR, filename)
        cv2.imwrite(path, frame)
        return path

    def _post_alert(self, payload, evidence_path):
        headers = {"Authorization": f"Token {BACKEND_AUTH_TOKEN}"} if BACKEND_AUTH_TOKEN else {}
        try:
            with open(evidence_path, "rb") as f:
                files = {"evidence_image": f}
                resp = requests.post(
                    f"{BACKEND_API_BASE}/alerts/", data=payload, files=files,
                    headers=headers, timeout=5,
                )
            if resp.status_code >= 300:
                print(f"[alert_engine] backend rejected alert: {resp.status_code} {resp.text}")
                return None
            return resp.json()
        except requests.exceptions.RequestException as e:
            print(f"[alert_engine] could not reach backend ({e}); alert kept local only.")
            return None
