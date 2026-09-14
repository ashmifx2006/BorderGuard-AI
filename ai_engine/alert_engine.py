"""Transparent contextual risk scoring and alert posting.

Risk is a prioritization aid over measurable video events. It is not a
prediction of criminal intent and must be reviewed by a human operator.
"""
import time
import os
import cv2
import requests
import json
from config import BACKEND_API_BASE, BACKEND_AUTH_TOKEN, ALERT_COOLDOWN_SECONDS, EVIDENCE_DIR

BASE_SCORES = {
    "NORMAL_DETECTION": 5,
    "UNUSUAL_MOVEMENT": 35,
    "RESTRICTED_ZONE_INTRUSION": 65,
    "PROLONGED_PRESENCE": 75,
    "COMPOUND_INCIDENT": 85,
}
ZONE_BONUS = {"LOW": 0, "MEDIUM": 5, "HIGH": 10, "CRITICAL": 15}


def score_event(event_type, zone, dwell, movement, active_object_count, repeated):
    score = BASE_SCORES.get(event_type, 5)
    factors = []
    if event_type != "NORMAL_DETECTION":
        factors.append(f"{event_type.replace('_', ' ').title()} +{BASE_SCORES.get(event_type, 5)}")
    if zone:
        bonus = ZONE_BONUS.get(zone.get("severity", "HIGH"), 10)
        score += bonus
        factors.append(f"{zone.get('severity', 'HIGH').title()} zone +{bonus}")
    if dwell >= 30:
        score += 15; factors.append("30s+ dwell +15")
    elif dwell >= 15:
        score += 10; factors.append("15s+ dwell +10")
    elif dwell >= 5:
        score += 5; factors.append("5s+ dwell +5")
    if movement.get("speed_px_s", 0) >= 180 or movement.get("direction_reversal"):
        score += 10; factors.append("unusual movement +10")
    if active_object_count > 1:
        bonus = min(10, (active_object_count - 1) * 5)
        score += bonus; factors.append(f"multiple tracked objects +{bonus}")
    if repeated:
        score += 10; factors.append("repeated event +10")
    score = min(100, max(0, int(score)))
    if score >= 80:
        level = "HIGH RISK"
    elif score >= 60:
        level = "SUSPICIOUS"
    elif score >= 30:
        level = "WATCH"
    else:
        level = "NORMAL"
    return score, level, factors


class AlertEngine:
    def __init__(self):
        self._last_fired = {}
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
        if event_type == "NORMAL_DETECTION" or self._on_cooldown(track_id, event_type):
            return None

        risk_score, risk_level, factors = score_event(
            event_type, event_result.get("zone"), event_result.get("dwell", 0),
            event_result.get("movement", {}), event_result.get("active_object_count", 1),
            event_result.get("repeated", False),
        )
        evidence_path = self._save_evidence(camera_id, track_id, frame)
        reasoning = "; ".join(factors)[:500]
        payload = {
            "camera": camera_id,
            "zone": event_result["zone"]["id"] if event_result.get("zone") else None,
            "event_type": event_type,
            "object_type": label,
            "severity": "CRITICAL" if risk_score >= 80 else "HIGH" if risk_score >= 60 else "MEDIUM" if risk_score >= 30 else "LOW",
            "confidence": confidence,
            "event_score": min(10, max(1, round(risk_score / 10))),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "reasoning": reasoning,
            "risk_factors": json.dumps(factors),
            "track_id": str(track_id),
            "dwell_seconds": event_result.get("dwell", 0),
            "movement_speed": event_result.get("movement", {}).get("speed_px_s", 0),
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
                resp = requests.post(
                    f"{BACKEND_API_BASE}/alerts/", data=payload,
                    files={"evidence_image": f}, headers=headers, timeout=5,
                )
            if resp.status_code >= 300:
                print(f"[alert_engine] backend rejected alert: {resp.status_code} {resp.text}")
                return None
            return resp.json()
        except requests.exceptions.RequestException as exc:
            print(f"[alert_engine] could not reach backend ({exc}); alert kept local only.")
            return None



