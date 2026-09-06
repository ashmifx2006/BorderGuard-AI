"""
video_processor.py — main entry point for the BorderGuard AI engine.

Pipeline:
    Video/Webcam
        ↓
    YOLO detection
        ↓
    Object tracking
        ↓
    DetectionEvent → Django
        ↓
    Zone analysis
        ↓
    Alert generation → Django

Run this as a SEPARATE process from the Django server.

Examples:

Webcam:
    python video_processor.py --source webcam --camera_id CAM-01

Video:
    python video_processor.py --source video --path ../media/videos/test.mp4 --camera_id CAM-01

Press 'q' in the video window to stop.
"""

import argparse
import time

import cv2
import requests

from detector import Detector
from tracker import CentroidTracker
from zone_detector import ZoneDetector
from event_engine import EventEngine
from alert_engine import AlertEngine
from config import BACKEND_API_BASE, BACKEND_AUTH_TOKEN


# Send the same tracked object to Django at most once per second.
# This prevents thousands of DetectionEvent records from being created.
DETECTION_REPORT_INTERVAL = 1.0


SEVERITY_COLOR = {
    "CRITICAL": (60, 60, 239),
    "HIGH": (58, 137, 245),
    "MEDIUM": (51, 194, 240),
    "LOW": (255, 141, 76),
}

LABEL_COLOR = {
    "person": (198, 209, 43),
    "vehicle": (255, 141, 76),
}


def fetch_zones(camera_id):
    """
    Fetch configured zones for this camera from Django.
    If Django cannot be reached, use a built-in demo zone.
    """

    headers = (
        {"Authorization": f"Token {BACKEND_AUTH_TOKEN}"}
        if BACKEND_AUTH_TOKEN
        else {}
    )

    try:
        resp = requests.get(
            f"{BACKEND_API_BASE}/zones/",
            params={"camera__camera_id": camera_id},
            headers=headers,
            timeout=5,
        )

        if resp.status_code == 200:
            zones = resp.json()

            if zones:
                return zones

    except requests.exceptions.RequestException:
        pass

    print(
        "[video_processor] Using built-in demo zone "
        "(backend unreachable or no zones configured)."
    )

    return [
        {
            "id": None,
            "name": "Demo Restricted Zone",
            "severity": "CRITICAL",
            "polygon": [
                [0.35, 0.2],
                [0.75, 0.2],
                [0.75, 0.8],
                [0.35, 0.8],
            ],
        }
    ]


def post_detection(camera_id, obj, zone):
    """
    Send a raw AI detection to Django.

    This creates a DetectionEvent record in the backend.
    """

    headers = (
        {"Authorization": f"Token {BACKEND_AUTH_TOKEN}"}
        if BACKEND_AUTH_TOKEN
        else {}
    )

    payload = {
        "camera": camera_id,
        "object_type": obj["label"],
        "confidence": obj["confidence"],
        "bbox": obj["bbox"],
        "zone": zone.get("id") if zone else None,
    }

    try:
        response = requests.post(
            f"{BACKEND_API_BASE}/detections/",
            json=payload,
            headers=headers,
            timeout=3,
        )

        if response.status_code >= 300:
            print(
                "[detection] Backend rejected detection: "
                f"{response.status_code} {response.text}"
            )
            return False

        return True

    except requests.exceptions.RequestException as error:
        print(
            f"[detection] Could not reach backend: {error}"
        )
        return False


def draw_zone(frame, zone):
    """Draw a restricted zone on the video frame."""

    h, w = frame.shape[:2]

    points = [
        (int(x * w), int(y * h))
        for x, y in zone["polygon"]
    ]

    color = SEVERITY_COLOR.get(
        zone["severity"],
        (255, 255, 255),
    )

    for i in range(len(points)):
        cv2.line(
            frame,
            points[i],
            points[(i + 1) % len(points)],
            color,
            2,
            cv2.LINE_AA,
        )

    cv2.putText(
        frame,
        zone["name"],
        points[0],
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        color,
        1,
        cv2.LINE_AA,
    )


def draw_detection(frame, obj_id, obj):
    """Draw detected/tracked object on the video frame."""

    x1, y1, x2, y2 = obj["bbox"]

    color = LABEL_COLOR.get(
        obj["label"],
        (255, 255, 255),
    )

    cv2.rectangle(
        frame,
        (x1, y1),
        (x2, y2),
        color,
        2,
    )

    label = (
        f"#{obj_id} "
        f"{obj['label']} "
        f"{obj['confidence'] * 100:.0f}%"
    )

    cv2.putText(
        frame,
        label,
        (x1, max(y1 - 8, 12)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        color,
        1,
        cv2.LINE_AA,
    )


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--source",
        choices=["webcam", "video"],
        default="webcam",
    )

    parser.add_argument(
        "--path",
        default="0",
        help="Video file path. Ignored for webcam.",
    )

    parser.add_argument(
        "--webcam_index",
        type=int,
        default=0,
    )

    parser.add_argument(
        "--camera_id",
        default="CAM-01",
    )

    args = parser.parse_args()

    # ---------------------------------------------------------
    # Open video source
    # ---------------------------------------------------------

    if args.source == "webcam":
        source = args.webcam_index
    else:
        source = args.path

    cap = cv2.VideoCapture(source)

    if not cap.isOpened():
        print("ERROR: could not open video source.")
        return

    # ---------------------------------------------------------
    # Initialize AI pipeline
    # ---------------------------------------------------------

    zones = fetch_zones(args.camera_id)

    zone_detector = ZoneDetector(zones)
    detector = Detector()
    tracker = CentroidTracker()
    event_engine = EventEngine()
    alert_engine = AlertEngine()

    # ---------------------------------------------------------
    # Detection reporting throttle
    # ---------------------------------------------------------

    last_detection_report = {}

    print(
        f"[video_processor] Running on camera_id={args.camera_id}, "
        f"source={args.source}. Press 'q' to quit."
    )

    prev_t = time.time()

    # ---------------------------------------------------------
    # Main video loop
    # ---------------------------------------------------------

    while True:

        ok, frame = cap.read()

        if not ok:
            print(
                "[video_processor] End of stream or read failure."
            )
            break

        # -----------------------------------------------------
        # YOLO detection
        # -----------------------------------------------------

        detections = detector.detect(frame)

        # -----------------------------------------------------
        # Object tracking
        # -----------------------------------------------------

        tracked = tracker.update(detections)

        h, w = frame.shape[:2]

        # -----------------------------------------------------
        # Draw zones
        # -----------------------------------------------------

        for zone in zones:
            draw_zone(frame, zone)

        # -----------------------------------------------------
        # Process tracked objects
        # -----------------------------------------------------

        for obj_id, obj in tracked.items():

            # Determine whether object is inside a restricted zone
            zone_hit = zone_detector.check(
                obj["centroid"],
                w,
                h,
            )

            # -------------------------------------------------
            # NEW:
            # Send raw detection to Django
            # -------------------------------------------------

            now = time.time()

            last_report = last_detection_report.get(
                obj_id,
                0,
            )

            if (
                now - last_report
                >= DETECTION_REPORT_INTERVAL
            ):

                success = post_detection(
                    args.camera_id,
                    obj,
                    zone_hit,
                )

                if success:
                    last_detection_report[obj_id] = now

            # -------------------------------------------------
            # Existing event analysis
            # -------------------------------------------------

            event_result = event_engine.evaluate(
                obj_id,
                obj["label"],
                zone_hit,
            )

            # Draw object
            draw_detection(
                frame,
                obj_id,
                obj,
            )

            # -------------------------------------------------
            # Existing alert generation
            # -------------------------------------------------

            alert = alert_engine.process(
                args.camera_id,
                obj_id,
                obj["label"],
                obj["confidence"],
                obj["bbox"],
                event_result,
                frame,
            )

            if alert:
                print(
                    f"[ALERT] "
                    f"{alert.get('severity')} — "
                    f"{alert.get('event_type')} "
                    f"on {args.camera_id}"
                )

        # -----------------------------------------------------
        # FPS calculation
        # -----------------------------------------------------

        now = time.time()

        fps = 1 / max(
            now - prev_t,
            1e-6,
        )

        prev_t = now

        # -----------------------------------------------------
        # Display status
        # -----------------------------------------------------

        cv2.putText(
            frame,
            (
                f"AI ACTIVE  |  "
                f"{args.camera_id}  |  "
                f"{fps:.1f} FPS"
            ),
            (10, 24),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (43, 209, 198),
            2,
            cv2.LINE_AA,
        )

        # -----------------------------------------------------
        # Show video
        # -----------------------------------------------------

        cv2.imshow(
            "BorderGuard AI - Live Feed (press q to quit)",
            frame,
        )

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    # ---------------------------------------------------------
    # Cleanup
    # ---------------------------------------------------------

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()