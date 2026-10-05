@echo off
REM Starts the Lunar Rover backend (port 8000) and frontend (port 3000) in two windows.
REM Run from anywhere:  start.bat   (double-click, or type it in cmd inside the lunar folder)
setlocal
set "ROOT=%~dp0lunar-rover"

if not exist "%ROOT%\data\processed\region.json" (
  echo.
  echo Lunar data has not been built yet. Run this once first ^(downloads about 400 MB from NASA^):
  echo   cd "%ROOT%\data-pipeline"
  echo   pip install -r requirements.txt
  echo   python build.py --download
  echo.
  pause
  exit /b 1
)

if not exist "%ROOT%\frontend\node_modules" (
  echo Installing frontend packages...
  pushd "%ROOT%\frontend"
  call npm install
  popd
)

start "Lunar Rover - backend (8000)" /d "%ROOT%\backend" cmd /k python -m uvicorn app.main:app --port 8000
start "Lunar Rover - frontend (3000)" /d "%ROOT%\frontend" cmd /k npm run dev

echo Waiting for the servers, then opening the game...
timeout /t 8 /nobreak >nul
start "" http://localhost:3000
endlocal
