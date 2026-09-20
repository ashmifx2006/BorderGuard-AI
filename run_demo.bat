@echo off
setlocal
cd /d "%~dp0"

echo ================================================
echo        BORDERGUARD AI - JUDGE DEMO
echo ================================================
echo.
echo Starting backend, frontend and both AI cameras...
echo.

REM ---------------- BACKEND ----------------
start "BorderGuard Backend" cmd /k ^
"cd /d "%~dp0backend" ^&^& venv\Scripts\activate ^&^& python manage.py runserver"

timeout /t 3 /nobreak >nul

REM ---------------- FRONTEND ----------------
start "BorderGuard React" cmd /k ^
"cd /d "%~dp0frontend" ^&^& npm run dev"

timeout /t 5 /nobreak >nul

REM ---------------- CAM-01 ----------------
start "BorderGuard CAM-01" cmd /k ^
"cd /d "%~dp0ai_engine" ^&^& venv\Scripts\activate ^&^& python video_processor.py --source video --path ..\media\screenshots\videos\test.mp4 --camera_id CAM-01 --stream_port 9000 --demo --loop"

timeout /t 3 /nobreak >nul

REM ---------------- CAM-02 ----------------
start "BorderGuard CAM-02" cmd /k ^
"cd /d "%~dp0ai_engine" ^&^& venv\Scripts\activate ^&^& python video_processor.py --source video --path ..\media\screenshots\videos\test2.mp4 --camera_id CAM-02 --stream_port 9001 --demo --loop"

echo.
echo ================================================
echo DEMO SERVICES STARTED
echo ================================================
echo.
echo Backend : http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo CAM-01  : http://127.0.0.1:9000/stream
echo CAM-02  : http://127.0.0.1:9001/stream
echo.
echo Close the four opened terminals to stop the demo.
echo.
pause

endlocal