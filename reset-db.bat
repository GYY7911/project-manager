@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    Project Manager - Reset Database
echo ========================================
echo.

echo [WARNING] This will:
echo   - Delete all data
echo   - Recreate database tables
echo   - Re-import seed data
echo.
set /p confirm="Continue? (y/N): "
if /i not "%confirm%"=="y" (
    echo Cancelled
    pause
    exit /b 0
)

echo.
echo [1/4] Stopping database containers...
docker compose down -v

echo [2/4] Starting database containers...
docker compose up -d

echo [3/4] Waiting for database...
timeout /t 5 /nobreak >nul

echo [4/4] Syncing database and seeding...
call pnpm db:generate
call pnpm db:push
call pnpm --filter=server db:seed

echo.
echo ========================================
echo    Database reset complete!
echo    Test account: admin / admin123
echo ========================================
pause
