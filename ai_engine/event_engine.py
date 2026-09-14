"""Rule-based event intelligence over tracked objects and configured zones.

This layer converts measurable video behaviour into explainable events. It
never infers identity, emotion, ethnicity, criminality, or intent.
"""
import time
from config import (
    PROLONGED_PRESENCE_SECONDS,
    ZONE_GRACE_SECONDS,
    UNUSUAL_SPEED_PX_PER_SEC,
    DIRECTION_REVERSAL_DOT_THRESHOLD,
    REPEAT_EVENT_WINDOW_SECONDS,
    COMPOUND_EVENT_WINDOW_SECONDS,
)


class EventEngine:
    def __init__(self):
        self.zone_entry_times = {}
        self.first_seen = {}
        self.previous_motion = {}
        self.recent_events = {}

    def _remember_event(self, track_id, event_type, now):
        events = self.recent_events.setdefault(track_id, [])
        events.append((event_type, now))
        cutoff = now - max(REPEAT_EVENT_WINDOW_SECONDS, COMPOUND_EVENT_WINDOW_SECONDS)
        self.recent_events[track_id] = [(kind, ts) for kind, ts in events if ts >= cutoff]

    def _movement_context(self, track_id, centroid, now):
        previous = self.previous_motion.get(track_id)
        movement = {"speed_px_s": 0.0, "direction_reversal": False}
        if previous:
            prev_centroid, prev_time, prev_velocity = previous
            dt = max(now - prev_time, 1e-3)
            vx = centroid[0] - prev_centroid[0]
            vy = centroid[1] - prev_centroid[1]
            speed = (vx * vx + vy * vy) ** 0.5 / dt
            reversal = False
            if prev_velocity is not None:
                dot = vx * prev_velocity[0] + vy * prev_velocity[1]
                reversal = dot < DIRECTION_REVERSAL_DOT_THRESHOLD and speed > 25
            movement = {
                "speed_px_s": round(speed, 2),
                "direction_reversal": reversal,
            }
            velocity = (vx, vy)
        else:
            velocity = None
        self.previous_motion[track_id] = (centroid, now, velocity)
        return movement

    def evaluate(self, track_id, label, zone, centroid=None, active_object_count=1):
        now = time.time()
        self.first_seen.setdefault(track_id, now)
        dwell = now - self.first_seen[track_id]
        movement = self._movement_context(track_id, centroid, now) if centroid is not None else {
            "speed_px_s": 0.0, "direction_reversal": False
        }

        if zone is None:
            self.zone_entry_times.pop(track_id, None)
            time_in_zone = 0.0
        else:
            entry = self.zone_entry_times.get(track_id)
            if entry is None or entry.get("zone_id") != zone.get("id"):
                self.zone_entry_times[track_id] = {"zone_id": zone.get("id"), "entered_at": now}
                time_in_zone = 0.0
            else:
                time_in_zone = now - entry["entered_at"]

        unusual = (
            label == "person"
            and movement["speed_px_s"] >= UNUSUAL_SPEED_PX_PER_SEC
        ) or movement["direction_reversal"]

        previous = self.recent_events.get(track_id, [])
        recent_non_normal = [
            kind for kind, ts in previous
            if now - ts <= REPEAT_EVENT_WINDOW_SECONDS and kind != "NORMAL_DETECTION"
        ]
        repeated = bool(recent_non_normal)
        compound_candidate = (
            any(kind == "RESTRICTED_ZONE_INTRUSION" for kind, ts in previous
                if now - ts <= COMPOUND_EVENT_WINDOW_SECONDS)
            and (unusual or time_in_zone > PROLONGED_PRESENCE_SECONDS)
        )

        reasons = []
        if zone:
            reasons.append(f"inside {zone.get('name', 'configured zone')}")
        if time_in_zone > 0:
            reasons.append(f"zone dwell {time_in_zone:.1f}s")
        if unusual:
            reasons.append(f"movement {movement['speed_px_s']:.0f}px/s" if movement["speed_px_s"] else "direction reversal")
        if active_object_count > 1:
            reasons.append(f"{active_object_count} tracked objects present")
        if repeated:
            reasons.append("repeated event in recent window")

        if zone and time_in_zone >= ZONE_GRACE_SECONDS:
            if compound_candidate:
                event_type = "COMPOUND_INCIDENT"
            elif time_in_zone > PROLONGED_PRESENCE_SECONDS:
                event_type = "PROLONGED_PRESENCE"
            elif unusual:
                event_type = "UNUSUAL_MOVEMENT"
            else:
                event_type = "RESTRICTED_ZONE_INTRUSION"
        elif unusual:
            event_type = "UNUSUAL_MOVEMENT"
        elif dwell > PROLONGED_PRESENCE_SECONDS and label == "person":
            event_type = "PROLONGED_PRESENCE"
        else:
            event_type = "NORMAL_DETECTION"

        if event_type != "NORMAL_DETECTION":
            self._remember_event(track_id, event_type, now)

        return {
            "event_type": event_type,
            "zone": zone,
            "dwell": round(time_in_zone if zone else dwell, 2),
            "movement": movement,
            "active_object_count": active_object_count,
            "repeated": repeated,
            "compound": event_type == "COMPOUND_INCIDENT",
            "reasons": reasons,
        }
