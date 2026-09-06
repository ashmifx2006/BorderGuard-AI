"""
event_engine.py — turns raw tracked-object + zone data into
security events, using simple, transparent, explainable rules.

IMPORTANT: this is a rule-based classifier over detections/zones/dwell
time. It does not infer intent — it flags configurable conditions
(presence in a zone, duration of presence) for a human operator to review.
"""
import time
from config import PROLONGED_PRESENCE_SECONDS, ZONE_GRACE_SECONDS


class EventEngine:
    def __init__(self):
        # track_id -> {zone_name, entered_at}
        self.zone_entry_times = {}
        # track_id -> first_seen_at (for prolonged presence, independent of zone)
        self.first_seen = {}

    def evaluate(self, track_id, label, zone):
        now = time.time()
        self.first_seen.setdefault(track_id, now)
        dwell = now - self.first_seen[track_id]

        if zone is None:
            self.zone_entry_times.pop(track_id, None)
            if dwell > PROLONGED_PRESENCE_SECONDS and label == "person":
                return {"event_type": "PROLONGED_PRESENCE", "zone": None, "dwell": dwell}
            return {"event_type": "NORMAL_DETECTION", "zone": None, "dwell": dwell}

        # object is inside a zone
        entry = self.zone_entry_times.get(track_id)
        if entry is None:
            self.zone_entry_times[track_id] = now
            time_in_zone = 0
        else:
            time_in_zone = now - entry

        if time_in_zone < ZONE_GRACE_SECONDS:
            # still within grace period - don't fire yet, avoids false positives
            # from someone briefly crossing the boundary
            return {"event_type": "NORMAL_DETECTION", "zone": zone, "dwell": dwell}

        if time_in_zone > PROLONGED_PRESENCE_SECONDS:
            return {"event_type": "PROLONGED_PRESENCE", "zone": zone, "dwell": time_in_zone}

        return {"event_type": "RESTRICTED_ZONE_INTRUSION", "zone": zone, "dwell": time_in_zone}
