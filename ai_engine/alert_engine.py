"""Transparent contextual risk scoring and alert posting.

Risk is a prioritization aid over measurable video events. It is not a
prediction of criminal intent and must be reviewed by a human operator.
"""

import time
import os
import cv2
import requests
import json

from config import (
    BACKEND_API_BASE,
    BACKEND_AUTH_TOKEN,
    ALERT_COOLDOWN_SECONDS,
    EVIDENCE_DIR,
)


# ---------------------------------------------------------------------------
# Base event risk scores
# ---------------------------------------------------------------------------

BASE_SCORES = {
    "NORMAL_DETECTION": 5,

    # Stage 1 existing events
    "UNUSUAL_MOVEMENT": 35,
    "RESTRICTED_ZONE_INTRUSION": 65,
    "PROLONGED_PRESENCE": 75,
    "COMPOUND_INCIDENT": 85,

    # Stage 1 advanced zone events
    "ZONE_ENTRY": 25,
    "ZONE_EXIT": 10,
}


# ---------------------------------------------------------------------------
# Zone severity bonuses
# ---------------------------------------------------------------------------

ZONE_BONUS = {
    "LOW": 0,
    "MEDIUM": 5,
    "HIGH": 10,
    "CRITICAL": 15,
}


def score_event(
    event_type,
    zone,
    dwell,
    movement,
    active_object_count,
    repeated,
):
    """Calculate an explainable 0-100 contextual risk score.

    The score is based only on measurable event context:
    - event type
    - zone severity
    - dwell time
    - movement behaviour
    - number of tracked objects
    - repeated recent activity

    It does not infer identity, intent, criminality, emotion, or ethnicity.
    """

    score = BASE_SCORES.get(event_type, 5)
    factors = []

    # -----------------------------------------------------------------------
    # Base event factor
    # -----------------------------------------------------------------------

    if event_type != "NORMAL_DETECTION":
        base_score = BASE_SCORES.get(event_type, 5)

        factors.append(
            f"{event_type.replace('_', ' ').title()} +{base_score}"
        )

    # -----------------------------------------------------------------------
    # Zone severity
    # -----------------------------------------------------------------------

    if zone:
        zone_severity = zone.get("severity", "HIGH")

        bonus = ZONE_BONUS.get(
            zone_severity,
            10,
        )

        score += bonus

        factors.append(
            f"{zone_severity.title()} zone +{bonus}"
        )

    # -----------------------------------------------------------------------
    # Dwell time
    # -----------------------------------------------------------------------

    if dwell >= 30:
        score += 15
        factors.append("30s+ dwell +15")

    elif dwell >= 15:
        score += 10
        factors.append("15s+ dwell +10")

    elif dwell >= 5:
        score += 5
        factors.append("5s+ dwell +5")

    # -----------------------------------------------------------------------
    # Movement behaviour
    # -----------------------------------------------------------------------

    speed = movement.get(
        "speed_px_s",
        0,
    )

    direction_reversal = movement.get(
        "direction_reversal",
        False,
    )

    if speed >= 180 or direction_reversal:
        score += 10

        if direction_reversal:
            factors.append(
                "direction reversal +10"
            )
        else:
            factors.append(
                "unusual movement +10"
            )

    # -----------------------------------------------------------------------
    # Multiple tracked objects
    # -----------------------------------------------------------------------

    if active_object_count > 1:
        bonus = min(
            10,
            (active_object_count - 1) * 5,
        )

        score += bonus

        factors.append(
            f"multiple tracked objects +{bonus}"
        )

    # -----------------------------------------------------------------------
    # Repeated activity
    # -----------------------------------------------------------------------

    if repeated:
        score += 10
        factors.append(
            "repeated event +10"
        )

    # -----------------------------------------------------------------------
    # Event-specific contextual adjustments
    # -----------------------------------------------------------------------

    if event_type == "ZONE_ENTRY":
        factors.append(
            "zone entry requires operator review"
        )

    elif event_type == "ZONE_EXIT":
        factors.append(
            "zone exit recorded"
        )

    elif event_type == "RESTRICTED_ZONE_INTRUSION":
        factors.append(
            "restricted-zone activity detected"
        )

    elif event_type == "PROLONGED_PRESENCE":
        factors.append(
            "prolonged presence detected"
        )

    elif event_type == "COMPOUND_INCIDENT":
        factors.append(
            "multiple event signals combined"
        )

    # -----------------------------------------------------------------------
    # Clamp score
    # -----------------------------------------------------------------------

    score = min(
        100,
        max(
            0,
            int(score),
        ),
    )

    # -----------------------------------------------------------------------
    # Risk level
    # -----------------------------------------------------------------------

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
    """Convert event intelligence into backend alerts and evidence."""

    def __init__(self):
        self._last_fired = {}

        os.makedirs(
            EVIDENCE_DIR,
            exist_ok=True,
        )

    # -----------------------------------------------------------------------
    # Alert cooldown
    # -----------------------------------------------------------------------

    def _on_cooldown(
        self,
        track_id,
        event_type,
    ):
        key = (
            track_id,
            event_type,
        )

        last = self._last_fired.get(
            key
        )

        now = time.time()

        if last and (
            now - last
        ) < ALERT_COOLDOWN_SECONDS:
            return True

        self._last_fired[key] = now

        return False

    # -----------------------------------------------------------------------
    # Process event
    # -----------------------------------------------------------------------

    def process(
        self,
        camera_id,
        track_id,
        label,
        confidence,
        bbox,
        event_result,
        frame,
    ):
        event_type = event_result[
            "event_type"
        ]

        # Normal detections are not posted as alerts.
        if event_type == "NORMAL_DETECTION":
            return None

        # Prevent alert flooding for the same track/event.
        if self._on_cooldown(
            track_id,
            event_type,
        ):
            return None

        # ---------------------------------------------------------------
        # Calculate contextual risk
        # ---------------------------------------------------------------

        risk_score, risk_level, factors = score_event(
            event_type,
            event_result.get(
                "zone"
            ),
            event_result.get(
                "dwell",
                0,
            ),
            event_result.get(
                "movement",
                {},
            ),
            event_result.get(
                "active_object_count",
                1,
            ),
            event_result.get(
                "repeated",
                False,
            ),
        )

        # ---------------------------------------------------------------
        # Save evidence
        # ---------------------------------------------------------------

        evidence_path = self._save_evidence(
            camera_id,
            track_id,
            frame,
        )

        # ---------------------------------------------------------------
        # Build explainable reasoning
        # ---------------------------------------------------------------

        reasoning = "; ".join(
            factors
        )[:500]

        # ---------------------------------------------------------------
        # Severity derived from risk score
        # ---------------------------------------------------------------

        if risk_score >= 80:
            severity = "CRITICAL"

        elif risk_score >= 60:
            severity = "HIGH"

        elif risk_score >= 30:
            severity = "MEDIUM"

        else:
            severity = "LOW"

        # ---------------------------------------------------------------
        # Backend payload
        # ---------------------------------------------------------------

        zone = event_result.get(
            "zone"
        )

        movement = event_result.get(
            "movement",
            {},
        )

        payload = {
            "camera": camera_id,

            "zone": (
                zone.get("id")
                if zone
                else None
            ),

            "event_type": event_type,

            "object_type": label,

            "severity": severity,

            "confidence": confidence,

            # Existing 1-10 event score compatibility.
            "event_score": min(
                10,
                max(
                    1,
                    round(
                        risk_score / 10
                    ),
                ),
            ),

            "risk_score": risk_score,

            "risk_level": risk_level,

            "reasoning": reasoning,

            "risk_factors": json.dumps(
                factors
            ),

            "track_id": str(
                track_id
            ),

            "dwell_seconds": event_result.get(
                "dwell",
                0,
            ),

            "movement_speed": movement.get(
                "speed_px_s",
                0,
            ),
        }

        return self._post_alert(
            payload,
            evidence_path,
        )

    # -----------------------------------------------------------------------
    # Evidence capture
    # -----------------------------------------------------------------------

    def _save_evidence(
        self,
        camera_id,
        track_id,
        frame,
    ):
        timestamp = int(
            time.time() * 1000
        )

        filename = (
            f"{camera_id}_"
            f"{track_id}_"
            f"{timestamp}.jpg"
        )

        path = os.path.join(
            EVIDENCE_DIR,
            filename,
        )

        cv2.imwrite(
            path,
            frame,
        )

        return path

    # -----------------------------------------------------------------------
    # Backend alert posting
    # -----------------------------------------------------------------------

    def _post_alert(
        self,
        payload,
        evidence_path,
    ):
        headers = (
            {
                "Authorization": (
                    f"Token {BACKEND_AUTH_TOKEN}"
                )
            }
            if BACKEND_AUTH_TOKEN
            else {}
        )

        try:
            with open(
                evidence_path,
                "rb",
            ) as evidence_file:

                response = requests.post(
                    f"{BACKEND_API_BASE}/alerts/",
                    data=payload,
                    files={
                        "evidence_image": evidence_file
                    },
                    headers=headers,
                    timeout=5,
                )

            if response.status_code >= 300:
                print(
                    "[alert_engine] "
                    f"backend rejected alert: "
                    f"{response.status_code} "
                    f"{response.text}"
                )

                return None

            return response.json()

        except requests.exceptions.RequestException as exc:
            print(
                "[alert_engine] "
                f"could not reach backend ({exc}); "
                "alert kept local only."
            )

            return None