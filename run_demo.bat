@echo off
setlocal
cd /d "%~dp0"

echo ================================================
echo BorderGuard AI - Judge Demo
echo ================================================
echo.

echo 1. Start Django backend in Terminal 1:
echo    cd backend ^&^& venv\Scripts\activate ^&^& python manage.py runserver
echo.
echo 2. Start React command center in Terminal 2:
echo    cd frontend ^&^& npm run dev
echo.
echo 3. This terminal will run the real YOLO demo loop.
echo.

cd ai_engine
if not exist venv\Scripts\python.exe (
  echo ERROR: ai_engine virtual environment not found.
  echo Create it with: python -m venv venv
  pause
  exit /b 1
)

venv\Scripts\python.exe demo_preflight.py --path ../media/videos/test.mp4
if errorlevel 1 (
  echo.
  echo Preflight failed. Place the real test.mp4 clip in media\videos\ and ensure .env is configured.
  pause
  exit /b 1
)

echo.
echo Starting DEMO MODE. Press Q in the OpenCV window to stop.
echo.
venv\Scripts\python.exe video_processor.py --source video --path ../media/videos/test.mp4 --camera_id CAM-01 --demo --loop
endlocal
