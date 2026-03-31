@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    Project Manager - Clean Cache Script
echo ========================================
echo.

echo [WARNING] This will delete:
echo   - node_modules (all packages)
echo   - .turbo (Turborepo cache)
echo   - .next (Next.js build cache)
echo   - dist (Backend build output)
echo.
set /p confirm="Continue? (y/N): "
if /i not "%confirm%"=="y" (
    echo Cancelled
    pause
    exit /b 0
)

echo.
echo [1/6] Cleaning root cache...
if exist "node_modules" rmdir /s /q "node_modules"
if exist ".turbo" rmdir /s /q ".turbo"

echo [2/6] Cleaning frontend cache...
if exist "apps\web\node_modules" rmdir /s /q "apps\web\node_modules"
if exist "apps\web\.next" rmdir /s /q "apps\web\.next"

echo [3/6] Cleaning backend cache...
if exist "apps\server\node_modules" rmdir /s /q "apps\server\node_modules"
if exist "apps\server\dist" rmdir /s /q "apps\server\dist"

echo [4/6] Cleaning shared package cache...
if exist "packages\shared\node_modules" rmdir /s /q "packages\shared\node_modules"
if exist "packages\shared\dist" rmdir /s /q "packages\shared\dist"

echo [5/6] Cleaning pnpm cache...
if exist ".pnpm-store" rmdir /s /q ".pnpm-store"

echo [6/6] Cleaning TypeScript build info...
del /s /q "*.tsbuildinfo" >nul 2>&1

echo.
echo ========================================
echo    Cache cleaned!
echo    Run start.bat to reinstall
echo ========================================
pause
