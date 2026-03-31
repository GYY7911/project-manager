@echo off
setlocal enabledelayedexpansion
title Project Manager - Starting...

echo.
echo  ========================================
echo     Project Manager - Start Script
echo  ========================================
echo.

:: ========================================
:: Step 0: Clean up old processes
:: ========================================
echo [0/5] Cleaning up old processes...

:: Kill any processes on ports 4000 and 4001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000.*LISTENING" 2^>nul') do (
    echo       Killing process on port 4000 (PID: %%a)
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4001.*LISTENING" 2^>nul') do (
    echo       Killing process on port 4001 (PID: %%a)
    taskkill /F /PID %%a >nul 2>&1
)

:: Wait a moment for ports to be released
timeout /t 2 /nobreak >nul

:: ========================================
:: Step 1: Check Docker
:: ========================================
echo [1/5] Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] Docker is not running!
    echo.
    echo  Please start Docker Desktop first.
    echo  Download: https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)
echo       Docker is running

:: ========================================
:: Step 2: Check pnpm
:: ========================================
echo [2/5] Checking pnpm...
where pnpm >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] pnpm not found!
    echo.
    echo  Please install pnpm:
    echo    npm install -g pnpm
    echo.
    pause
    exit /b 1
)
echo       pnpm is installed

:: ========================================
:: Step 3: Start database
:: ========================================
echo [3/5] Starting database...
docker compose up -d 2>nul
if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to start database containers!
    echo.
    echo  Make sure ports 5432 and 6379 are not in use.
    echo.
    pause
    exit /b 1
)
echo       Database containers started

:: Wait for database
echo       Waiting for database...
timeout /t 3 /nobreak >nul

:: ========================================
:: Step 4: Setup
:: ========================================
echo [4/5] Setup...

if not exist "node_modules" (
    echo       Installing dependencies...
    pnpm install
    if errorlevel 1 (
        echo.
        echo  [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
) else (
    echo       Dependencies OK
)

:: Setup Prisma
echo       Setting up database...
pnpm db:generate >nul 2>&1
pnpm db:push >nul 2>&1

:: Seed database
echo       Seeding database...
cd apps\server 2>nul
call pnpm db:seed >nul 2>&1
cd ..\.. 2>nul

:: ========================================
:: Step 5: Start servers
:: ========================================
echo [5/5] Starting servers...
echo.
echo  ========================================
echo   Starting services...
echo  ----------------------------------------
echo   Frontend: http://localhost:4000
echo   Backend:  http://localhost:4001
echo  ----------------------------------------
echo   Test accounts:
echo   - Admin:  admin / admin123
echo   - Member: z00123123 / 123456
echo  ========================================
echo.
echo  Press Ctrl+C to stop
echo.

:: Run dev server
pnpm dev

:: Keep window open if there's an error
if errorlevel 1 (
    echo.
    echo  [ERROR] Servers failed to start!
    echo  Check the error message above.
    echo.
    pause
)
