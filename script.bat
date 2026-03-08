@echo off
setlocal
cd /d "%~dp0"

if not exist "backend\package.json" (
    echo [ERROR] backend\package.json not found.
    exit /b 1
)

if not exist "frontend\package.json" (
    echo [ERROR] frontend\package.json not found.
    exit /b 1
)

start "Backend - API" cmd /k "cd /d ""%~dp0backend"" && npm run dev"
start "Frontend - Vite" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo Backend and frontend are launching in separate windows.
echo Press Ctrl+C in each window to stop the servers.
