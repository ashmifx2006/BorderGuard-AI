# Running BorderGuard AI locally (VS Code)

You'll run **three separate processes** in **three separate terminals** inside VS Code:
1. Django backend (API + database)
2. React frontend (dashboard)
3. AI engine (video processing — only when you want live detection running)

Open the `BorderGuard-AI` folder in VS Code first: File → Open Folder.

---

## 1. Backend (Django)

Open a terminal in VS Code (`` Ctrl+` `` / `` Cmd+` ``) and run:

```bash
cd backend
python -m venv venv
```

Activate it:
- **Windows:** `venv\Scripts\activate`
- **Mac/Linux:** `source venv/bin/activate`

```bash
pip install -r requirements.txt
copy .env.example .env        # Windows
cp .env.example .env          # Mac/Linux

python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

Follow the prompts to set a username/password — **use these to log into the dashboard**.

Seed demo cameras and a zone so the dashboard isn't empty:

```bash
python manage.py seed_demo_data
```

Start the server:

```bash
python manage.py runserver
```

Leave this running. Backend is now live at `http://127.0.0.1:8000`.
Django admin (to add/edit cameras and zones visually) is at `http://127.0.0.1:8000/admin/`.

---

## 2. Frontend (React)

Open a **second terminal** in VS Code:

```bash
cd frontend
npm install
npm run dev
```

Open the URL it prints — usually `http://localhost:5173`.

Log in with the superuser username/password you created above. You should see the
Command Center Dashboard with your seeded cameras.

---

## 3. AI engine (real YOLO detection)

Open a **third terminal**:

```bash
cd ai_engine
python -m venv venv
```

Activate it (same as above), then:

```bash
pip install -r requirements.txt
```

**First run downloads the YOLOv8n model weights (~6MB, needs internet once).**

### Get a DRF auth token for the AI engine to post alerts

With the backend running, in a browser or via curl:

```bash
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_USERNAME","password":"YOUR_PASSWORD"}'
```

Copy the `token` value from the response, then paste it into `ai_engine/config.py`:

```python
BACKEND_AUTH_TOKEN = "paste-your-token-here"
```

### Run it against your webcam

```bash
python video_processor.py --source webcam --camera_id CAM-01
```

A window titled "BorderGuard AI - Live Feed" opens showing your webcam with bounding
boxes. Walk into the drawn zone rectangle and hold still — after a couple of seconds
you'll see an alert appear on the React dashboard's Active Alerts page.

Press **q** in that window to stop.

### Run it against an uploaded video file instead

Drop an .mp4 into `media/videos/`, then:

```bash
python video_processor.py --source video --path ../media/videos/your_clip.mp4 --camera_id CAM-01
```

---

## Common issues

- **"Could not open video source"** — webcam index might not be `0` on your machine; try
  `--webcam_index 1`.
- **No alerts appearing on dashboard** — check the AI engine terminal for
  `[alert_engine] could not reach backend` — usually means the Django server isn't running,
  the token is missing/wrong, or CORS is blocking it (check `backend/.env`).
- **YOLO download fails** — needs internet on first run only, to fetch `yolov8n.pt`. If your
  network blocks it, download the file manually from the Ultralytics GitHub releases and place
  it in `ai_engine/`.
- **`ultralytics` install is slow/large** — it pulls in PyTorch. This is expected; give it a
  few minutes on first install.

## Suggested demo flow (3–5 minutes)

1. Show the dashboard with seeded cameras (already looks populated).
2. Explain the architecture diagram (in the README / AI Analytics page).
3. Start `video_processor.py` on your webcam, live, in front of judges.
4. Walk into the restricted zone drawn on screen — narrate what's happening
   (detection → tracking → zone check → event classification → alert).
5. Switch to the browser — show the new alert appear on the Active Alerts page in real time.
6. Acknowledge / resolve it from the dashboard to show the human-in-the-loop workflow.
