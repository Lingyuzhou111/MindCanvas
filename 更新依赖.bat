@echo off
title Update Dependencies

echo Current directory: %cd%
echo.

if exist node_modules (
    echo Cleaning old libraries...
    rmdir /s /q node_modules
)

if exist package-lock.json (
    echo Resetting lockfile...
    del /f package-lock.json
)

echo.
echo Installing all dependencies (including devDependencies)...
echo Please wait, this may take a few minutes...
echo.

call npm install

if errorlevel 1 (
    echo.
    echo ERROR: Installation failed!
    echo Please check your internet connection and Node.js installation.
    echo.
    pause
    exit /b 1
)

echo.
echo Verifying installation...

if not exist "node_modules\concurrently" (
    echo ERROR: Required package 'concurrently' not found!
    echo Trying to install again...
    call npm install concurrently --save-dev
)

echo.
echo ===================================
echo Dependencies installed successfully!
echo Location: %cd%\node_modules
echo ===================================
echo.
pause
