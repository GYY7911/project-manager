@echo off
title PM System - Service Check

echo.
echo  ========================================
echo     Service Status Check
echo  ========================================
echo.

echo [1] Checking Docker...
docker ps 2>nul | findstr pm- >nul
if errorlevel 1 (
    echo     [X] Docker containers NOT running
    echo     Run start.bat first!
) else (
    echo     [OK] Docker containers running
)

echo.
echo [2] Checking Backend (port 4001)...
curl -s -o nul -w "     [OK] Backend responding (HTTP %%{http_code})\n" http://localhost:4001/api/auth/me 2>nul
if errorlevel 1 (
    echo     [X] Backend NOT responding
    echo     Check if port 4001 is blocked
)

echo.
echo [3] Checking Frontend (port 4000)...
curl -s -o nul -w "     [OK] Frontend responding (HTTP %%{http_code})\n" http://localhost:4000 2>nul
if errorlevel 1 (
    echo     [X] Frontend NOT responding
    echo     Check if port 4000 is blocked
)

echo.
echo  ========================================
echo   If all services show [OK], open:
echo   http://localhost:4000
echo  ========================================
echo.
pause
