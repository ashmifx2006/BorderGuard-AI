"""
Central configuration for the AI engine.
Edit these values to tune detection without touching the pipeline code.

Secrets and deployment-specific values are read from environment variables.
"""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().with_name(".env"))
except ImportError:
    pass


# COCO class IDs (from the pretrained YOLOv8 model) that we care about.
# 0 = person, 2 = car, 3 = motorcycle, 5 = bus, 7 = truck
TARGET_CLASSES = {0: "person", 2: "vehicle", 3: "vehicle", 5: "vehicle", 7: "vehicle"}

MIN_CONFIDENCE = 0.5          # discard detections below this
PROLONGED_PRESENCE_SECONDS = 15   # seconds inside a zone before "prolonged presence"
ZONE_GRACE_SECONDS = 2         # seconds a track must be in-zone before intrusion fires
ALERT_COOLDOWN_SECONDS = 20    # don't re-fire the same track+event within this window
UNUSUAL_SPEED_PX_PER_SEC = float(os.getenv("BORDERGUARD_UNUSUAL_SPEED_PX_S", "180"))
DIRECTION_REVERSAL_DOT_THRESHOLD = float(os.getenv("BORDERGUARD_DIRECTION_REVERSAL_DOT", "-50"))
REPEAT_EVENT_WINDOW_SECONDS = float(os.getenv("BORDERGUARD_REPEAT_WINDOW", "60"))
COMPOUND_EVENT_WINDOW_SECONDS = float(os.getenv("BORDERGUARD_COMPOUND_WINDOW", "30"))

BACKEND_API_BASE = os.getenv("BORDERGUARD_API_BASE", "http://127.0.0.1:8000/api").rstrip("/")
BACKEND_AUTH_TOKEN = os.getenv("BORDERGUARD_API_TOKEN", "")

# Keep paths stable regardless of the directory from which video_processor.py is launched.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = os.getenv("BORDERGUARD_EVIDENCE_DIR", str(PROJECT_ROOT / "media" / "evidence"))

# Phase 1 telemetry controls. Events are persisted at a bounded rate so a 25 FPS
# video does not create thousands of identical database rows per minute.
DETECTION_LOG_INTERVAL_SECONDS = float(os.getenv("BORDERGUARD_DETECTION_LOG_INTERVAL", "1.0"))
HEARTBEAT_INTERVAL_SECONDS = float(os.getenv("BORDERGUARD_HEARTBEAT_INTERVAL", "2.0"))
