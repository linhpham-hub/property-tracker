@echo off
REM Double-click to publish your latest changes to the live site.
REM Vercel rebuilds property-tracker-jade.vercel.app automatically ~1 min after this finishes.
cd /d "%~dp0"
echo Publishing changes...
git add .
git commit -m "Update %date% %time%"
git push
echo.
echo Done. The live site will update in about 1 minute.
pause
