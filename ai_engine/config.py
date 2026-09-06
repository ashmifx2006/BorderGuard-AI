"""
Central configuration for the AI engine.
Edit these values to tune detection without touching the pipeline code.
"""

# COCO class IDs (from the pretrained YOLOv8 model) that we care about.
# 0 = person, 2 = car, 3 = motorcycle, 5 = bus, 7 = truck
TARGET_CLASSES = {0: "person", 2: "vehicle", 3: "vehicle", 5: "vehicle", 7: "vehicle"}

MIN_CONFIDENCE = 0.5          # discard detections below this
PROLONGED_PRESENCE_SECONDS = 15   # seconds inside a zone before "prolonged presence"
ZONE_GRACE_SECONDS = 2         # seconds a track must be in-zone before intrusion fires
ALERT_COOLDOWN_SECONDS = 20    # don't re-fire the same track+event within this window

BACKEND_API_BASE = "http://127.0.0.1:8000/api"
BACKEND_AUTH_TOKEN = "b68cdcb3e96a6d8f145f82484d272a13b6f281c2"      # paste a DRF token here (see run_project.md) or set via env var

EVIDENCE_DIR = "../media/evidence"
