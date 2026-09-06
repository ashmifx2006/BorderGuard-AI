# BorderGuard AI
**"From Passive CCTV to Intelligent Security."**

AI-powered video analytics platform for border surveillance (Problem Statement 26187).
Built for a Smart India Hackathon submission by an AI & Data Science student.

## What it does

BorderGuard AI is a software layer over existing CCTV infrastructure that:
- Detects people and vehicles in video (YOLOv8 via Ultralytics)
- Tracks them across frames (lightweight centroid tracker)
- Checks their position against configurable restricted zones
- Classifies events (normal detection, restricted-zone intrusion, prolonged presence)
- Assigns a transparent, rule-based priority score and severity
- Captures an evidence frame and posts the alert to a Django REST backend
- Displays everything on a React command-center dashboard for a human operator to review, acknowledge, investigate, and resolve

**Important:** this is a rule-based decision-support tool. It does not claim to detect
criminal intent — it flags configurable conditions for a human operator to verify.

## Architecture

```
Video Source (webcam / uploaded file / future RTSP)
        ↓
OpenCV Video Processing
        ↓
YOLO Object Detection (Ultralytics, person + vehicle classes)
        ↓
Centroid Object Tracking
        ↓
Zone & Dwell-Time Analysis
        ↓
Event Detection Engine (rule-based)
        ↓
Alert Priority Engine (rule-based scoring)
        ↓
Evidence Capture (JPEG frame)
        ↓
Django REST API  →  SQLite (Postgres-ready)
        ↓
React Dashboard  →  Human Operator Verification
```

## Project layout

```
BorderGuard-AI/
├── backend/         Django + DRF REST API, models, auth
├── ai_engine/        OpenCV/YOLO detection pipeline (separate process)
├── frontend/          React + Vite command-center dashboard
├── media/             Uploaded videos, evidence captures
└── run_project.md    Step-by-step setup & run instructions
```

## Tech stack

- **Backend:** Python 3.11+, Django 5, Django REST Framework, SQLite (Postgres-ready), Token auth
- **AI:** OpenCV, Ultralytics YOLOv8, NumPy
- **Frontend:** React 18, Vite, React Router, Axios, Recharts

## Quick start

See **run_project.md** for exact step-by-step commands. Short version:

1. Backend: create venv → `pip install -r backend/requirements.txt` → migrate → `createsuperuser` → `seed_demo_data` → `runserver`
2. Frontend: `npm install` → `npm run dev`
3. AI engine: separate venv → `pip install -r ai_engine/requirements.txt` → `python video_processor.py --source webcam`

## Notes for the hackathon demo

- The dashboard works immediately after seeding demo data, even before you run the AI engine —
  good for a clean opening screen.
- Run `video_processor.py` live during the demo (point your webcam at yourself and step into
  the zone) to show a real alert appear on the dashboard in real time.
- If you don't want to depend on a live webcam during judging, pre-record a short clip of someone
  walking into frame and run the AI engine against that file instead (`--source video --path ...`).
