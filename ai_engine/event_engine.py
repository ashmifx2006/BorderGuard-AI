"""Rule-based event intelligence over tracked objects and configured zones.

This layer converts measurable video behaviour into explainable events.

It intentionally does NOT infer:
- identity
- emotion
- ethnicity
- criminality
- intent

All event decisions are based only on measurable video behaviour.
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

        # Track the zone currently occupied by each object.
        self.current_zones = {}

        # Used to detect a transition into/out of a zone.
        self.previous_zone_state = {}

    # ------------------------------------------------------------------
    # EVENT MEMORY
    # ------------------------------------------------------------------

    def _remember_event(self, track_id, event_type, now):
        events = self.recent_events.setdefault(track_id, [])

        events.append((event_type, now))

        cutoff = now - max(
            REPEAT_EVENT_WINDOW_SECONDS,
            COMPOUND_EVENT_WINDOW_SECONDS,
        )

        self.recent_events[track_id] = [
            (kind, timestamp)
            for kind, timestamp in events
            if timestamp >= cutoff
        ]

    # ------------------------------------------------------------------
    # MOVEMENT INTELLIGENCE
    # ------------------------------------------------------------------

    def _movement_context(self, track_id, centroid, now):
        previous = self.previous_motion.get(track_id)

        movement = {
            "speed_px_s": 0.0,
            "direction_reversal": False,
        }

        if previous:
            prev_centroid, prev_time, prev_velocity = previous

            dt = max(now - prev_time, 1e-3)

            dx = centroid[0] - prev_centroid[0]
            dy = centroid[1] - prev_centroid[1]

            speed = ((dx * dx) + (dy * dy)) ** 0.5 / dt

            reversal = False

            if prev_velocity is not None:
                dot = (
                    dx * prev_velocity[0]
                    + dy * prev_velocity[1]
                )

                reversal = (
                    dot < DIRECTION_REVERSAL_DOT_THRESHOLD
                    and speed > 25
                )

            movement = {
                "speed_px_s": round(speed, 2),
                "direction_reversal": reversal,
            }

            velocity = (dx, dy)

        else:
            velocity = None

        self.previous_motion[track_id] = (
            centroid,
            now,
            velocity,
        )

        return movement

    # ------------------------------------------------------------------
    # ZONE TRANSITIONS
    # ------------------------------------------------------------------

    def _zone_context(self, track_id, zone, now):
        """
        Detect zone entry / exit transitions.

        Returns:
            {
                "zone_entry": bool,
                "zone_exit": bool,
                "time_in_zone": float,
            }
        """

        previous_zone = self.previous_zone_state.get(track_id)

        current_zone_id = zone.get("id") if zone else None

        zone_entry = (
            current_zone_id is not None
            and previous_zone is None
        )

        zone_change = (
            current_zone_id is not None
            and previous_zone is not None
            and current_zone_id != previous_zone
        )

        zone_exit = (
            current_zone_id is None
            and previous_zone is not None
        )

        # A transition from one zone directly into another
        # is treated as a new entry into the new zone.
        if zone_change:
            zone_entry = True

        self.previous_zone_state[track_id] = current_zone_id

        # Maintain dwell timing.
        if zone is None:
            self.zone_entry_times.pop(track_id, None)
            time_in_zone = 0.0

        else:
            entry = self.zone_entry_times.get(track_id)

            if (
                entry is None
                or entry.get("zone_id") != current_zone_id
            ):
                self.zone_entry_times[track_id] = {
                    "zone_id": current_zone_id,
                    "entered_at": now,
                }

                time_in_zone = 0.0

            else:
                time_in_zone = now - entry["entered_at"]

        return {
            "zone_entry": zone_entry,
            "zone_exit": zone_exit,
            "time_in_zone": time_in_zone,
        }

    # ------------------------------------------------------------------
    # STALE TRACK CLEANUP
    # ------------------------------------------------------------------

    def cleanup_track(self, track_id):
        """
        Remove state when a tracker permanently loses an object.
        """

        self.zone_entry_times.pop(track_id, None)
        self.first_seen.pop(track_id, None)
        self.previous_motion.pop(track_id, None)
        self.recent_events.pop(track_id, None)
        self.current_zones.pop(track_id, None)
        self.previous_zone_state.pop(track_id, None)

    # ------------------------------------------------------------------
    # MAIN EVENT EVALUATION
    # ------------------------------------------------------------------

    def evaluate(
        self,
        track_id,
        label,
        zone,
        centroid=None,
        active_object_count=1,
    ):
        now = time.time()

        # --------------------------------------------------------------
        # FIRST SEEN / GLOBAL DWELL
        # --------------------------------------------------------------

        self.first_seen.setdefault(
            track_id,
            now,
        )

        dwell = now - self.first_seen[track_id]

        # --------------------------------------------------------------
        # MOVEMENT
        # --------------------------------------------------------------

        if centroid is not None:
            movement = self._movement_context(
                track_id,
                centroid,
                now,
            )
        else:
            movement = {
                "speed_px_s": 0.0,
                "direction_reversal": False,
            }

        # --------------------------------------------------------------
        # ZONE CONTEXT
        # --------------------------------------------------------------

        zone_context = self._zone_context(
            track_id,
            zone,
            now,
        )

        zone_entry = zone_context["zone_entry"]
        zone_exit = zone_context["zone_exit"]
        time_in_zone = zone_context["time_in_zone"]

        if zone:
            self.current_zones[track_id] = zone.get("id")
        else:
            self.current_zones.pop(track_id, None)

        # --------------------------------------------------------------
        # UNUSUAL MOVEMENT
        # --------------------------------------------------------------

        unusual = (
            (
                label == "person"
                and movement["speed_px_s"]
                >= UNUSUAL_SPEED_PX_PER_SEC
            )
            or movement["direction_reversal"]
        )

        # --------------------------------------------------------------
        # RECENT EVENTS
        # --------------------------------------------------------------

        previous = self.recent_events.get(
            track_id,
            [],
        )

        recent_non_normal = [
            kind
            for kind, timestamp in previous
            if (
                now - timestamp
                <= REPEAT_EVENT_WINDOW_SECONDS
                and kind != "NORMAL_DETECTION"
            )
        ]

        repeated = bool(recent_non_normal)

        # --------------------------------------------------------------
        # COMPOUND INCIDENT
        # --------------------------------------------------------------

        recent_restricted_intrusion = any(
            kind == "RESTRICTED_ZONE_INTRUSION"
            and (
                now - timestamp
                <= COMPOUND_EVENT_WINDOW_SECONDS
            )
            for kind, timestamp in previous
        )

        prolonged = (
            time_in_zone > PROLONGED_PRESENCE_SECONDS
            or (
                dwell > PROLONGED_PRESENCE_SECONDS
                and label == "person"
            )
        )

        compound_candidate = (
            recent_restricted_intrusion
            and (
                unusual
                or prolonged
            )
        )

        # --------------------------------------------------------------
        # EXPLAINABLE REASONS
        # --------------------------------------------------------------

        reasons = []

        if zone:
            reasons.append(
                f"inside {zone.get('name', 'configured zone')}"
            )

        if zone_entry:
            reasons.append(
                "entered configured zone"
            )

        if zone_exit:
            reasons.append(
                "exited configured zone"
            )

        if time_in_zone > 0:
            reasons.append(
                f"zone dwell {time_in_zone:.1f}s"
            )

        if movement["speed_px_s"] > 0:
            reasons.append(
                f"movement {movement['speed_px_s']:.0f}px/s"
            )

        if movement["direction_reversal"]:
            reasons.append(
                "direction reversal detected"
            )

        if active_object_count > 1:
            reasons.append(
                f"{active_object_count} tracked objects present"
            )

        if repeated:
            reasons.append(
                "repeated event in recent window"
            )

        if prolonged:
            reasons.append(
                "prolonged presence detected"
            )

        # --------------------------------------------------------------
        # EVENT CLASSIFICATION
        # --------------------------------------------------------------

        # Zone exit is a transition event and should be visible
        # independently from intrusion logic.
        if zone_exit:
            event_type = "ZONE_EXIT"

        elif zone and zone_entry:
            event_type = "ZONE_ENTRY"

        elif (
            zone
            and time_in_zone >= ZONE_GRACE_SECONDS
        ):
            if compound_candidate:
                event_type = "COMPOUND_INCIDENT"

            elif prolonged:
                event_type = "PROLONGED_PRESENCE"

            elif unusual:
                event_type = "UNUSUAL_MOVEMENT"

            else:
                event_type = "RESTRICTED_ZONE_INTRUSION"

        elif unusual:
            event_type = "UNUSUAL_MOVEMENT"

        elif prolonged and label == "person":
            event_type = "PROLONGED_PRESENCE"

        else:
            event_type = "NORMAL_DETECTION"

        # --------------------------------------------------------------
        # REMEMBER NON-NORMAL EVENTS
        # --------------------------------------------------------------

        if event_type != "NORMAL_DETECTION":
            self._remember_event(
                track_id,
                event_type,
                now,
            )

        # --------------------------------------------------------------
        # RESULT
        # --------------------------------------------------------------

        return {
            "event_type": event_type,
            "zone": zone,

            "dwell": round(
                time_in_zone
                if zone
                else dwell,
                2,
            ),

            "movement": movement,

            "active_object_count": active_object_count,

            "zone_entry": zone_entry,
            "zone_exit": zone_exit,

            "repeated": repeated,

            "compound": (
                event_type == "COMPOUND_INCIDENT"
            ),

            "reasons": reasons,
        }