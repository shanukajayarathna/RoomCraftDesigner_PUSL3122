@echo off
SET ROOT=%~dp0

echo.
echo  ============================================
echo   RoomCraft Designer - Starting Up
echo  ============================================
echo.

REM Clean stale compiled classes
echo [Step 1/3] Cleaning old compiled files...
if exist "%ROOT%backend\target" (
    rmdir /s /q "%ROOT%backend\target"
    echo   Done - target folder removed.
) else (
    echo   Nothing to clean.
)

REM Start backend
echo.
echo [Step 2/3] Starting Spring Boot backend (port 8080)...
echo   A new terminal window will open for the backend.
echo   Wait for it to show: Started RoomCraftApplication
echo.
start "RoomCraft Backend" cmd /k "cd /d %ROOT%backend && mvn spring-boot:run"

REM Wait for backend
echo [Waiting 35 seconds for backend to start...]
timeout /t 35 /nobreak > nul

REM Start frontend
echo.
echo [Step 3/3] Starting React frontend (port 5173)...
start "RoomCraft Frontend" cmd /k "cd /d %ROOT%frontend && npm install && npm run dev"

echo.
echo  ============================================
echo   Open browser: http://localhost:5173
echo.
echo   Demo login:   demo  / demo123
echo   Admin login:  admin / admin123
echo  ============================================
echo.
pause
