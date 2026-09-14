import time
from alert_engine import score_event
from event_engine import EventEngine


def test_risk_bands():
    assert score_event("NORMAL_DETECTION", None, 0, {}, 1, False)[1] == "NORMAL"
    assert score_event("UNUSUAL_MOVEMENT", None, 0, {"speed_px_s": 200}, 1, False)[1] == "WATCH"
    assert score_event("RESTRICTED_ZONE_INTRUSION", {"severity": "CRITICAL"}, 2, {}, 1, False)[1] == "HIGH RISK"


def test_unusual_movement_is_generated():
    engine = EventEngine()
    first = engine.evaluate(1, "person", None, centroid=(10, 10), active_object_count=1)
    assert first["event_type"] == "NORMAL_DETECTION"
    time.sleep(0.01)
    second = engine.evaluate(1, "person", None, centroid=(200, 10), active_object_count=1)
    assert second["event_type"] == "UNUSUAL_MOVEMENT"


if __name__ == "__main__":
    test_risk_bands()
    test_unusual_movement_is_generated()
    print("AI intelligence tests: PASS")
