@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    Project Manager - Stop Script
echo ========================================
echo.

echo [1/2] Stopping development servers...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4000 ^| findstr LISTENING') do (
    echo Stopping port 4000 (PID: %%a)
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4001 ^| findstr LISTENING') do (
    echo Stopping port 4001 (PID: %%a)
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/2] Stopping database containers...
docker compose down

echo.
echo ========================================
echo    All services stopped
echo ========================================
pause
