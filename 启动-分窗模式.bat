@echo off
chcp 65001 >nul
title MindCanvas Split-Window Launcher

echo ============================================
echo    MindCanvas - Split Window Mode
echo ============================================
echo.

rem Check environment
if not exist "node_modules" (
    echo [System] Installing missing components...
    call npm install
)

rem Clear ports
echo [System] Scanning for port conflicts...
netstat -ano | findstr :3001 >nul && (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do taskkill /F /PID %%a >nul 2>&1
)
netstat -ano | findstr :5173 >nul && (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do taskkill /F /PID %%a >nul 2>&1
)

echo [System] Initializing MindCanvas Services...
echo --------------------------------------------

rem Start Backend
echo [*] Connecting Backend Engine (3001)...
start "MindCanvas-Server" cmd /c "chcp 65001 >nul && title MindCanvas-Server && node server.js"

rem Wait
timeout /t 2 /nobreak >nul

rem Start Frontend
echo [*] Opening Frontend Interface (5173)...
start "MindCanvas-Web" cmd /c "chcp 65001 >nul && title MindCanvas-Web && npm run dev -- --host"

echo --------------------------------------------
echo.
echo [OK] Services started successfully!
echo URL: http://localhost:5173
echo.
echo Guide:
echo    - Backend window: Ctrl+C to stop core logic
echo    - Frontend window: Ctrl+C to stop interface
echo.
echo [Main window will close automatically...]
echo.
timeout /t 3 /nobreak >nul
exit
