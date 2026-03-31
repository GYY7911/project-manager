@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   项目管理器 - 开发环境启动
echo ========================================
echo.

:: 清理端口
echo [1/3] 清理端口...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000.*LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4001.*LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo       端口已清理

:: 同步数据库（可选）
echo.
echo [2/3] 检查数据库...
cd /d "%~dp0.."
call pnpm db:push >nul 2>&1
echo       数据库已同步

:: 启动服务
echo.
echo [3/3] 启动服务...
echo.
echo   前端: http://localhost:4000
echo   后端: http://localhost:4001/api
echo.
echo   测试账号: admin / admin123
echo.
echo ========================================
echo   按 Ctrl+C 停止服务
echo ========================================
echo.

call pnpm dev
