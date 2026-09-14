# BorderGuard AI — Judge Demo Mode

This is the repeatable presentation path for the hackathon build.

## Important boundary

`DEMO MODE` is a presentation/looping mode. It **does not create fake detections, fake alerts, fake evidence, or fake camera health**. All security events shown by the AI engine must come from the supplied video through the real OpenCV + YOLO + tracker + zone + event + risk pipeline.

The sector map in the React command center is explicitly a **simulated/demo sector visualization** and must not be presented as a live border map.

## Prepare

1. Put the approved demo recording at:

```text
media/videos/test.mp4
```

2. Configure `ai_engine/.env` with the Django API token.
3. Seed the demo cameras and zone:

```text
cd backend
python manage.py seed_demo_data
```

## Judge run

### Terminal 1 — backend

```text
cd backend
venv\Scripts\activate
python manage.py runserver
```

### Terminal 2 — React

```text
cd frontend
npm install
npm run dev
```

### Terminal 3 — AI

Windows shortcut from the project root:

```text
run_demo.bat
```

Or directly:

```text
cd ai_engine
venv\Scripts\activate
python demo_preflight.py --path ../media/videos/test.mp4
python video_processor.py --source video --path ../media/videos/test.mp4 --camera_id CAM-01 --demo --loop
```

## Judge narration

1. **LOGIN** — authenticate into the command center.
2. **CAM-01** — show the camera telemetry and AI status.
3. **DETECTION** — show YOLO bounding boxes and confidence.
4. **TRACKING** — point out persistent track IDs.
5. **VIRTUAL ZONE** — show the configured restricted polygon.
6. **EVENT** — explain that measurable movement/dwell/zone conditions become events.
7. **RISK** — show the contextual 0–100 score and its factors.
8. **ALERT** — open the incident drawer and explain what/where/when/why.
9. **EVIDENCE** — show the captured frame and integrity state.
10. **HUMAN REVIEW** — acknowledge, investigate, add notes, then resolve.
11. **ANALYTICS** — show the resulting real backend counts and trends.

## Optional annotated recording

To save the actual annotated AI output while processing:

```text
python video_processor.py --source video --path ../media/videos/test.mp4 --camera_id CAM-01 --demo --loop --output ../media/videos/test_annotated.mp4
```

For a non-interactive recording/CI pass, add `--headless`.

## If test.mp4 is missing

The preflight intentionally fails. This is deliberate: the project must not claim a real demo event without an actual video source.
