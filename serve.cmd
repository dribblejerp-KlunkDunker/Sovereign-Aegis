@echo off
REM SOVEREIGN // AEGIS - launch the app in your browser.
REM Opening index.html directly does NOT work: Chrome blocks ES modules over file://
REM so the app must be served over HTTP. This starts a local zero-dependency server.
REM Double-click this file, or run it from a terminal. Ctrl+C to stop.
cd /d "%~dp0"
node serve.js %*
if errorlevel 1 (
  echo.
  echo Could not start. Is Node.js installed?  https://nodejs.org
  pause
)
