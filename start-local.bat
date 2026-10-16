@echo off
REM Double-click to run the app on this computer (localhost:3000).
REM Keep this window open while you use it; close it to stop.
cd /d "%~dp0"
echo Starting Property Tracker on http://localhost:3000 ...
start "" cmd /c "timeout /t 10 > NUL & start http://localhost:3000/agents"
npm run dev
pause
