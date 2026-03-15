@echo off
rem Set code page to UTF-8 to support Chinese characters in the terminal
chcp 65001 >nul

title MindCanvas One-Click Start

echo ============================================
echo    MindCanvas - Creative Flow Engine
echo ============================================
echo.

rem 1. Check for node_modules
if not exist "node_modules" (
    echo [System] Dependencies missing. Installing...
    echo.
    call npm install
    if errorlevel 1 (
        echo [Error] Failed to install dependencies. Please check your internet.
        pause
        exit /b 1
    )
    echo [Success] Installation complete.
    echo.
)

rem 2. Check and kill existing ports
echo [System] Checking system environment...
netstat -ano | findstr :3001 >nul && (
    echo [System] Cleaning port 3001...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)
netstat -ano | findstr :5173 >nul && (
    echo [System] Cleaning port 5173...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo [System] Launching MindCanvas...

rem 3. Start development server
rem We use 'call' and 'start' to ensure smooth background execution
start "MindCanvas-Core" /b npm run dev

rem 4. Wait for initialization
timeout /t 5 /nobreak >nul

rem 5. Open browser
start http://localhost:5173/

echo.
echo ============================================
echo [OK] MindCanvas is now RUNNING!
echo URL: http://localhost:5173
echo.
echo Tip: Close this window or press Ctrl+C to stop.
echo ============================================
echo.

pause >nul
