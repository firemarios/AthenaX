@echo off
setlocal EnableExtensions
chcp 65001 >nul
title ATHENAX dev - web :3000 ^| api :8000
cd /d "%~dp0"

echo ============================================================
echo   ATHENAX / POLICYLAB - development
echo ============================================================
echo   Mode         next dev (Turbopack) + uvicorn --reload
echo   Web          http://localhost:3000
echo   API          http://localhost:8000
echo   API same     http://localhost:3000/api
echo   API docs     http://localhost:8000/docs
echo   API docs*    http://localhost:3000/api/docs
echo   Postgres     localhost:5432   (optional)
echo   MinIO        9000 / 9001      (optional)
echo ============================================================
echo   Non-localhost browsers call /api on the same origin;
echo   Next.js proxies /api to the API (no CORS, one URL).
echo ============================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [!] Python was not found on PATH.
  goto :fail
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [!] npm was not found on PATH.
  goto :fail
)

python -c "import uvicorn" >nul 2>nul
if errorlevel 1 (
  echo [!] uvicorn is not installed for this Python.
  echo     Run: python -m pip install -r requirements-dev.txt
  goto :fail
)

if not exist "node_modules\next" (
  echo [setup] Installing npm dependencies...
  call npm.cmd install
  if errorlevel 1 goto :fail
)

set "PYTHONPATH=%CD%;%CD%\apps\api"
set "API_STARTED="

call :port_bound 8000
if errorlevel 1 (
  call :api_healthy
  if errorlevel 1 (
    echo [!] Port 8000 is in use, but /health did not respond as the ATHENAX API.
    echo     Stop the process on port 8000 and try again.
    goto :fail
  )
  echo [1/2] Reusing the API already running on http://127.0.0.1:8000
) else (
  echo [1/2] Starting API with reload on http://127.0.0.1:8000 ...
  start "ATHENAX API" /b cmd /c "python -m uvicorn app.main:app --app-dir apps/api --reload --host 127.0.0.1 --port 8000"
  set "API_STARTED=1"
  call :wait_for_api
  if errorlevel 1 goto :fail
)

call :port_bound 3000
if errorlevel 1 (
  echo [!] Port 3000 is already in use. Stop the existing web server first.
  goto :fail
)

echo [2/2] Starting Next.js dev on http://localhost:3000 ...
echo.
echo Press Ctrl+C to stop the whole stack.
echo.
call npm.cmd run dev --workspace apps/web -- --hostname 0.0.0.0 --port 3000
set "EXITCODE=%ERRORLEVEL%"

if defined API_STARTED (
  echo.
  echo Stopping API on port 8000 ...
  call :stop_api
)

if not "%EXITCODE%"=="0" (
  echo.
  echo Stack stopped with code %EXITCODE%.
  pause
)
exit /b %EXITCODE%

:port_bound
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %~1 -ErrorAction SilentlyContinue | Where-Object { $_.RemotePort -eq 0 }) { exit 1 } else { exit 0 }"
exit /b %ERRORLEVEL%

:api_healthy
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 http://127.0.0.1:8000/health; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1"
exit /b %ERRORLEVEL%

:wait_for_api
for /l %%i in (1,1,30) do (
  call :api_healthy
  if not errorlevel 1 exit /b 0
  ping -n 2 127.0.0.1 >nul
)
echo [!] API did not become healthy within 60 seconds.
exit /b 1

:stop_api
powershell -NoProfile -Command "$pids = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Where-Object { $_.RemotePort -eq 0 } | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }" >nul 2>nul
exit /b 0

:fail
if defined API_STARTED call :stop_api
echo.
echo Startup failed.
pause
exit /b 1
