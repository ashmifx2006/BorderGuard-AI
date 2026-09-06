"""
detector.py — wraps Ultralytics YOLO for person/vehicle detection.

Downloads the small pretrained model (yolov8n.pt) automatically on first
run (needs internet once). Runs entirely on CPU by default; will use a
GPU automatically if CUDA is available.
"""
from ultralytics import YOLO
from config import TARGET_CLASSES, MIN_CONFIDENCE


class Detector:
    def __init__(self, model_path="yolov8n.pt"):
        self.model = YOLO(model_path)

    def detect(self, frame):
        """
        Returns a list of dicts: {bbox:[x1,y1,x2,y2], label, confidence}
        bbox is in pixel coordinates for the given frame.
        """
        results = self.model(frame, verbose=False)[0]
        detections = []
        for box in results.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            if cls_id not in TARGET_CLASSES or conf < MIN_CONFIDENCE:
                continue
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0]]
            detections.append({
                "bbox": [x1, y1, x2, y2],
                "label": TARGET_CLASSES[cls_id],
                "confidence": round(conf, 3),
            })
        return detections
