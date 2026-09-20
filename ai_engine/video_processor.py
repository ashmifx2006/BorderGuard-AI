"""
video_processor.py — main entry point for the BorderGuard AI engine.

Pipeline:
Video/Webcam
    ↓
YOLO Detection
    ↓
Centroid Tracking
    ↓
Zone Analysis
    ↓
Event Intelligence
    ↓
Risk Scoring
    ↓
Alert + Evidence
    ↓
Annotated MJPEG Stream
    ↓
React Dashboard

Run this as a SEPARATE process from Django.
"""

import argparse
import time
import cv2
import requests
import threading

from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from detector import Detector
from tracker import CentroidTracker
from zone_detector import ZoneDetector
from event_engine import EventEngine
from alert_engine import AlertEngine, score_event

from config import (
    BACKEND_API_BASE,
    BACKEND_AUTH_TOKEN,
    DETECTION_LOG_INTERVAL_SECONDS,
    HEARTBEAT_INTERVAL_SECONDS,
)


# ============================================================
# VISUAL CONFIGURATION
# ============================================================

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


# ============================================================
# SHARED ANNOTATED FRAME STREAM
# ============================================================

_latest_frame = None
_frame_lock = threading.Lock()


def update_stream_frame(frame):
    """
    Encode the latest AI-annotated frame as JPEG.
    """

    global _latest_frame

    ok, encoded = cv2.imencode(".jpg", frame)

    if not ok:
        return

    with _frame_lock:
        _latest_frame = encoded.tobytes()


class AnnotatedStreamHandler(BaseHTTPRequestHandler):

    def do_GET(self):

        if self.path != "/stream":
            self.send_response(404)
            self.end_headers()
            return

        self.send_response(200)

        self.send_header(
            "Content-Type",
            "multipart/x-mixed-replace; boundary=frame",
        )

        self.send_header(
            "Cache-Control",
            "no-cache, no-store, must-revalidate",
        )

        self.send_header(
            "Pragma",
            "no-cache",
        )

        self.send_header(
            "Connection",
            "close",
        )

        self.end_headers()

        try:

            while True:

                with _frame_lock:
                    frame = _latest_frame

                if frame is not None:

                    self.wfile.write(
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n"
                        + frame
                        + b"\r\n"
                    )

                    self.wfile.flush()

                time.sleep(0.05)

        except (
            BrokenPipeError,
            ConnectionResetError,
            ConnectionAbortedError,
        ):
            pass

    def log_message(self, format, *args):
        return


def start_annotated_stream_server(
    host="127.0.0.1",
    port=9000,
):

    server = ThreadingHTTPServer(
        (host, port),
        AnnotatedStreamHandler,
    )

    thread = threading.Thread(
        target=server.serve_forever,
        daemon=True,
    )

    thread.start()

    print(
        "[video_processor] Annotated AI stream available at "
        f"http://{host}:{port}/stream"
    )

    return server


# ============================================================
# BACKEND COMMUNICATION
# ============================================================

def fetch_zones(camera_id):
    """
    Fetch active security zones configured in Django
    for the selected camera.

    Only active zones are used by the AI engine.
    """

    headers = (
        {"Authorization": f"Token {BACKEND_AUTH_TOKEN}"}
        if BACKEND_AUTH_TOKEN
        else {}
    )

    try:

        resp = requests.get(
            f"{BACKEND_API_BASE}/zones/",
            params={
                "camera__camera_id": camera_id,
                "is_active": "true",
            },
            headers=headers,
            timeout=5,
        )

        if resp.status_code == 200:

            zones = resp.json()

            if zones:

                print(
                    f"[video_processor] Loaded "
                    f"{len(zones)} active zone(s) "
                    f"for {camera_id}."
                )

                for zone in zones:

                    print(
                        f"[video_processor] Zone: "
                        f"{zone.get('name')} | "
                        f"{zone.get('severity')} | "
                        f"ACTIVE"
                    )

                return zones

            print(
                f"[video_processor] No active zones configured "
                f"for {camera_id}."
            )

            return []

        print(
            "[video_processor] Zone API returned "
            f"{resp.status_code}: {resp.text}"
        )

    except requests.exceptions.RequestException as exc:

        print(
            "[video_processor] Could not fetch zones "
            f"from backend: {exc}"
        )

    print(
        "[video_processor] Using built-in demo zone "
        "(backend unreachable)."
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

        resp = requests.post(
            f"{BACKEND_API_BASE}/detections/",
            json=payload,
            headers=headers,
            timeout=3,
        )

        if resp.status_code >= 300:

            print(
                "[video_processor] detection rejected: "
                f"{resp.status_code} {resp.text}"
            )

    except requests.exceptions.RequestException as exc:

        print(
            "[video_processor] detection telemetry unavailable: "
            f"{exc}"
        )


def post_heartbeat(camera_id, fps, source_type):

    headers = (
        {"Authorization": f"Token {BACKEND_AUTH_TOKEN}"}
        if BACKEND_AUTH_TOKEN
        else {}
    )

    try:

        resp = requests.post(
            f"{BACKEND_API_BASE}/cameras/{camera_id}/heartbeat/",
            json={
                "fps": fps,
                "source_type": source_type,
            },
            headers=headers,
            timeout=3,
        )

        if resp.status_code >= 300:

            print(
                "[video_processor] heartbeat rejected: "
                f"{resp.status_code} {resp.text}"
            )

    except requests.exceptions.RequestException as exc:

        print(
            "[video_processor] heartbeat unavailable: "
            f"{exc}"
        )


# ============================================================
# DRAWING
# ============================================================

def draw_zone(frame, zone):

    h, w = frame.shape[:2]

    pts = [
        (int(x * w), int(y * h))
        for x, y in zone["polygon"]
    ]

    color = SEVERITY_COLOR.get(
        zone.get("severity"),
        (255, 255, 255),
    )

    for i in range(len(pts)):

        cv2.line(
            frame,
            pts[i],
            pts[(i + 1) % len(pts)],
            color,
            2,
            cv2.LINE_AA,
        )

    if pts:

        cv2.putText(
            frame,
            zone.get("name", "ZONE"),
            pts[0],
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            color,
            1,
            cv2.LINE_AA,
        )


def draw_detection(frame, obj_id, obj):

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


def draw_ai_event_overlay(
    frame,
    event_result,
    risk_score=None,
    risk_level=None,
    track_id=None,
):
    """
    Draw explainable AI event + risk information.
    """

    event_type = event_result.get(
        "event_type",
        "NORMAL_DETECTION",
    )

    zone = event_result.get("zone")

    movement = event_result.get(
        "movement",
        {},
    )

    zone_name = (
        zone.get("name", "NONE")
        if zone
        else "NONE"
    )

    dwell = event_result.get(
        "dwell",
        0.0,
    )

    speed = movement.get(
        "speed_px_s",
        0.0,
    )

    direction_reversal = movement.get(
        "direction_reversal",
        False,
    )

    active_objects = event_result.get(
        "active_object_count",
        1,
    )

    repeated = event_result.get(
        "repeated",
        False,
    )

    compound = event_result.get(
        "compound",
        False,
    )

    h, w = frame.shape[:2]

    panel_x = max(
        10,
        w - 370,
    )

    panel_y = 65

    panel_w = 360

    panel_h = 235

    # --------------------------------------------------------
    # PANEL BACKGROUND
    # --------------------------------------------------------

    overlay = frame.copy()

    cv2.rectangle(
        overlay,
        (panel_x, panel_y),
        (
            panel_x + panel_w,
            panel_y + panel_h,
        ),
        (15, 20, 30),
        -1,
    )

    cv2.addWeighted(
        overlay,
        0.84,
        frame,
        0.16,
        0,
        frame,
    )

    # --------------------------------------------------------
    # RISK COLOR
    # --------------------------------------------------------

    border_color = (
        (60, 60, 239)
        if risk_score is not None and risk_score >= 80
        else (58, 137, 245)
        if risk_score is not None and risk_score >= 60
        else (51, 194, 240)
        if risk_score is not None and risk_score >= 30
        else (43, 209, 198)
    )

    # --------------------------------------------------------
    # PANEL BORDER
    # --------------------------------------------------------

    cv2.rectangle(
        frame,
        (panel_x, panel_y),
        (
            panel_x + panel_w,
            panel_y + panel_h,
        ),
        border_color,
        2,
    )

    # --------------------------------------------------------
    # HEADER
    # --------------------------------------------------------

    cv2.putText(
        frame,
        "AI EVENT INTELLIGENCE",
        (
            panel_x + 12,
            panel_y + 24,
        ),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (43, 209, 198),
        1,
        cv2.LINE_AA,
    )

    # --------------------------------------------------------
    # RISK BAR
    # --------------------------------------------------------

    if risk_score is not None:

        bar_x = panel_x + 12
        bar_y = panel_y + 31
        bar_w = panel_w - 24
        bar_h = 7

        cv2.rectangle(
            frame,
            (bar_x, bar_y),
            (
                bar_x + bar_w,
                bar_y + bar_h,
            ),
            (70, 75, 85),
            -1,
        )

        safe_score = max(
            0,
            min(100, risk_score),
        )

        filled_w = int(
            bar_w * (safe_score / 100.0)
        )

        if filled_w > 0:

            cv2.rectangle(
                frame,
                (bar_x, bar_y),
                (
                    bar_x + filled_w,
                    bar_y + bar_h,
                ),
                border_color,
                -1,
            )

    # --------------------------------------------------------
    # EVENT
    # --------------------------------------------------------

    event_display = event_type.replace(
        "_",
        " ",
    )

    lines = [
        f"EVENT   {event_display}",
        (
            f"TRACK   #{track_id}"
            if track_id is not None
            else "TRACK   -"
        ),
        f"ZONE    {zone_name}",
        f"DWELL   {dwell:.1f}s",
        f"SPEED   {speed:.0f}px/s",
        f"OBJECTS {active_objects}",
    ]

    if direction_reversal:

        lines.append(
            "MOTION  DIRECTION REVERSAL"
        )

    if risk_score is not None:

        lines.append(
            f"RISK    {risk_score}/100"
        )

        if risk_level:

            lines.append(
                f"LEVEL   {risk_level}"
            )

    if repeated:

        lines.append(
            "REPEAT  YES"
        )

    if compound:

        lines.append(
            "COMPOUND YES"
        )

    # --------------------------------------------------------
    # TEXT
    # --------------------------------------------------------

    y = panel_y + 48

    for line in lines:

        cv2.putText(
            frame,
            line[:47],
            (
                panel_x + 12,
                y,
            ),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.42,
            (225, 230, 235),
            1,
            cv2.LINE_AA,
        )

        y += 19

        if y > panel_y + panel_h - 8:
            break


def draw_event_reason_overlay(
    frame,
    event_result,
):
    """
    Display one concise explainable reason.
    """

    reasons = event_result.get(
        "reasons",
        [],
    )

    if not reasons:
        return

    event_type = event_result.get(
        "event_type",
        "NORMAL_DETECTION",
    )

    if event_type == "NORMAL_DETECTION":
        return

    reason_text = " | ".join(
        reasons[:2]
    )

    h, _ = frame.shape[:2]

    cv2.rectangle(
        frame,
        (10, h - 58),
        (
            min(700, frame.shape[1] - 10),
            h - 15,
        ),
        (15, 20, 30),
        -1,
    )

    cv2.putText(
        frame,
        "WHY: " + reason_text[:85],
        (18, h - 32),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.42,
        (240, 194, 51),
        1,
        cv2.LINE_AA,
    )


# ============================================================
# MAIN AI PIPELINE
# ============================================================

def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--source",
        choices=["webcam", "video"],
        default="webcam",
    )

    parser.add_argument(
        "--path",
        default="../media/videos/test.mp4",
        help="video file path (ignored for webcam)",
    )

    parser.add_argument(
        "--demo",
        action="store_true",
        help="Enable judge-facing DEMO MODE overlay",
    )

    parser.add_argument(
        "--loop",
        action="store_true",
        help="Loop a video file until q is pressed",
    )

    parser.add_argument(
        "--output",
        default="",
        help="Optional path for saving annotated video",
    )

    parser.add_argument(
        "--headless",
        action="store_true",
        help="Process without opening an OpenCV window",
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
    parser.add_argument(
    "--stream_port",
    type=int,
    default=9000,
    help="HTTP MJPEG stream port for this camera",
)

    args = parser.parse_args()

    # ========================================================
    # VIDEO SOURCE
    # ========================================================

    video_path = (
        args.path
        if args.source == "video"
        else None
    )

    cap = cv2.VideoCapture(
        args.webcam_index
        if args.source == "webcam"
        else video_path
    )

    if not cap.isOpened():

        print(
            "ERROR: could not open video source."
        )

        return

    # ========================================================
    # DEMO VIDEO VALIDATION
    # ========================================================

    if (
        args.demo
        and args.source == "video"
        and not Path(args.path).exists()
    ):

        print(
            f"ERROR: DEMO MODE video not found: {args.path}"
        )

        print(
            "Place test.mp4 in media/videos/ "
            "or pass --path <clip>. "
            "No simulated detections are generated."
        )

        cap.release()

        return

    # ========================================================
    # AI COMPONENTS
    # ========================================================

    zones = fetch_zones(
        args.camera_id
    )

    zone_detector = ZoneDetector(
        zones
    )

    detector = Detector()

    tracker = CentroidTracker()

    event_engine = EventEngine()

    alert_engine = AlertEngine()

    # ========================================================
    # OPTIONAL OUTPUT VIDEO
    # ========================================================

    writer = None

    if args.output:

        fps_out = (
            cap.get(
                cv2.CAP_PROP_FPS
            )
            or 25.0
        )

        width_out = int(
            cap.get(
                cv2.CAP_PROP_FRAME_WIDTH
            )
            or 1280
        )

        height_out = int(
            cap.get(
                cv2.CAP_PROP_FRAME_HEIGHT
            )
            or 720
        )

        fourcc = cv2.VideoWriter_fourcc(
            *"mp4v"
        )

        writer = cv2.VideoWriter(
            args.output,
            fourcc,
            fps_out,
            (
                width_out,
                height_out,
            ),
        )

        if not writer.isOpened():

            print(
                f"ERROR: could not open output writer: "
                f"{args.output}"
            )

            writer = None

    # ========================================================
    # START ANNOTATED STREAM SERVER
    # ========================================================

    stream_server = start_annotated_stream_server(port=args.stream_port)

    print(
        "[video_processor] Running on "
        f"camera_id={args.camera_id}, "
        f"source={args.source}. "
        "Press 'q' to quit."
    )

    if args.demo:

        print(
            "[video_processor] DEMO MODE: "
            "real YOLO/tracking/events only; "
            "no synthetic alerts are injected."
        )

    print(
        "[video_processor] Browser stream: "
        f"http://127.0.0.1:{args.stream_port}/stream"
    )

    # ========================================================
    # TIMING
    # ========================================================

    prev_t = time.time()

    last_heartbeat = 0.0

    last_detection_log = {}

    # ========================================================
    # MAIN PROCESSING LOOP
    # ========================================================

    try:

        while True:

            ok, frame = cap.read()

            # ------------------------------------------------
            # END OF VIDEO
            # ------------------------------------------------

            if not ok:

                if (
                    args.source == "video"
                    and args.loop
                ):

                    cap.set(
                        cv2.CAP_PROP_POS_FRAMES,
                        0,
                    )

                    tracker = CentroidTracker()

                    event_engine = EventEngine()

                    alert_engine = AlertEngine()

                    last_detection_log.clear()

                    print(
                        "[video_processor] "
                        "Looping demo clip."
                    )

                    continue

                print(
                    "[video_processor] "
                    "End of stream or read failure."
                )

                break

            # ------------------------------------------------
            # YOLO DETECTION
            # ------------------------------------------------

            detections = detector.detect(
                frame
            )

            # ------------------------------------------------
            # OBJECT TRACKING
            # ------------------------------------------------

            tracked = tracker.update(
                detections
            )

            h, w = frame.shape[:2]

            # ------------------------------------------------
            # DRAW CONFIGURED ZONES
            # ------------------------------------------------

            for zone in zones:

                draw_zone(
                    frame,
                    zone,
                )

            # ------------------------------------------------
            # PROCESS TRACKED OBJECTS
            # ------------------------------------------------

            for obj_id, obj in tracked.items():

                zone_hit = zone_detector.check(
                    obj["centroid"],
                    w,
                    h,
                )

                event_result = event_engine.evaluate(
                    obj_id,
                    obj["label"],
                    zone_hit,
                    centroid=obj["centroid"],
                    active_object_count=len(tracked),
                )

                draw_detection(
                    frame,
                    obj_id,
                    obj,
                )

                # ------------------------------------------------
                # EXACT SAME RISK SCORING AS ALERT ENGINE
                # ------------------------------------------------

                risk_score, risk_level, _ = score_event(
                    event_result.get(
                        "event_type",
                        "NORMAL_DETECTION",
                    ),
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

                # ------------------------------------------------
                # AI EVENT + RISK PANEL
                # ------------------------------------------------

                draw_ai_event_overlay(
                    frame,
                    event_result,
                    risk_score=risk_score,
                    risk_level=risk_level,
                    track_id=obj_id,
                )

                # ------------------------------------------------
                # EXPLAINABLE REASON
                # ------------------------------------------------

                draw_event_reason_overlay(
                    frame,
                    event_result,
                )

                # ------------------------------------------------
                # DETECTION TELEMETRY
                # ------------------------------------------------

                detection_key = (
                    obj_id,
                    zone_hit.get("id")
                    if zone_hit
                    else None,
                )

                now_for_log = time.time()

                if (
                    now_for_log
                    - last_detection_log.get(
                        detection_key,
                        0.0,
                    )
                    >= DETECTION_LOG_INTERVAL_SECONDS
                ):

                    post_detection(
                        args.camera_id,
                        obj,
                        zone_hit,
                    )

                    last_detection_log[
                        detection_key
                    ] = now_for_log

                # ------------------------------------------------
                # RISK + ALERT ENGINE
                # ------------------------------------------------

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

            # =================================================
            # FPS
            # =================================================

            now = time.time()

            fps = 1 / max(
                now - prev_t,
                1e-6,
            )

            prev_t = now

            # =================================================
            # HEARTBEAT
            # =================================================

            if (
                now - last_heartbeat
                >= HEARTBEAT_INTERVAL_SECONDS
            ):

                source_type = (
                    "WEBCAM"
                    if args.source == "webcam"
                    else "UPLOAD"
                )

                post_heartbeat(
                    args.camera_id,
                    fps,
                    source_type,
                )

                last_heartbeat = now

            # =================================================
            # AI STATUS OVERLAY
            # =================================================

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

            # =================================================
            # DEMO OVERLAY
            # =================================================

            if args.demo:

                cv2.putText(
                    frame,
                    "DEMO MODE  |  SIMULATED BORDER SECTOR",
                    (10, 48),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (240, 194, 51),
                    1,
                    cv2.LINE_AA,
                )

                cv2.putText(
                    frame,
                    (
                        "DETECTION > TRACKING > "
                        "ZONE > EVENT > RISK > ALERT"
                    ),
                    (
                        10,
                        frame.shape[0] - 12,
                    ),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.45,
                    (180, 190, 205),
                    1,
                    cv2.LINE_AA,
                )

            # =================================================
            # PUBLISH SAME ANNOTATED FRAME TO BROWSER
            # =================================================

            update_stream_frame(
                frame
            )

            # =================================================
            # OPTIONAL SAVE
            # =================================================

            if writer is not None:

                writer.write(
                    frame
                )

            # =================================================
            # OPTIONAL OPENCV WINDOW
            # =================================================

            if not args.headless:

                cv2.imshow(
                    "BorderGuard AI - Live Feed "
                    "(press q to quit)",
                    frame,
                )

                if (
                    cv2.waitKey(1) & 0xFF
                    == ord("q")
                ):

                    break

    except KeyboardInterrupt:

        print(
            "[video_processor] "
            "Stopping AI engine..."
        )

    finally:

        cap.release()

        if writer is not None:
            writer.release()

        cv2.destroyAllWindows()

        stream_server.shutdown()

        stream_server.server_close()

        print(
            "[video_processor] "
            "AI engine stopped."
        )


if __name__ == "__main__":
    main()