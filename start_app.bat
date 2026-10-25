@echo off
chcp 65001 >nul
echo ============================================================================
echo   UNSA - ANALISIS Y DISENO DE ALGORITMOS (LABORATORIO 05 - EJERCICIOS 7, 8, 9)
echo   Sistema Inteligente de Rutas, Trafico y Mente Colmena - Provincia de Arequipa
echo ============================================================================
echo.

if not exist "%~dp0backend\node_modules" (
    echo [INSTALACION] Detectado primer inicio: Instalando dependencias del Backend...
    cd /d "%~dp0backend" && call npm install
    cd /d "%~dp0"
)

if not exist "%~dp0frontend\node_modules" (
    echo [INSTALACION] Detectado primer inicio: Instalando dependencias del Frontend...
    cd /d "%~dp0frontend" && call npm install
    cd /d "%~dp0"
)

echo [1/3] Verificando motor algoritmico nativo C++20...
if not exist "%~dp0cpp_engine\bin" mkdir "%~dp0cpp_engine\bin"
if not exist "%~dp0cpp_engine\bin\engine.exe" (
    echo Compilando motor C++20 con g++ (-O3 -std=c++20)...
    g++ -O3 -std=c++20 -Wall -Wextra -I"%~dp0cpp_engine/include" "%~dp0cpp_engine/src/cli_engine.cpp" -o "%~dp0cpp_engine/bin/engine.exe"
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] No se pudo compilar C++20. Asegurate de tener g++ o MinGW en el PATH.
        pause
        exit /b 1
    )
)
echo       Motor C++20 verificado en cpp_engine\bin\engine.exe

echo.
echo [2/3] Iniciando Servidor Backend (Node.js v22 + SQLite Nativo + Google Places API) en puerto 3001...
start "UNSA ADA Backend (Puerto 3001)" cmd /k "cd /d %~dp0backend && npm start"

echo.
echo [3/3] Iniciando Servidor Frontend React + Vite en puerto 5173...
start "UNSA ADA Frontend (Puerto 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 >nul
start http://localhost:5173
echo.
echo ============================================================================
echo Aplicacion desplegada exitosamente:
echo   - Frontend Interactivo: http://localhost:5173
echo   - Backend API REST:     http://localhost:3001/api/health
echo ============================================================================
