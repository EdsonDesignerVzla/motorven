@echo off
title SIGNUM MOTORVEN - SERVIDOR PRINCIPAL
color 0A
cd /d "%~dp0"
cls
echo ======================================================================
echo    SIGNUM MOTORVEN - INICIO DEL SERVIDOR PRINCIPAL DE LA OFICINA
echo ======================================================================
echo.
echo  [1/2] Iniciando Base de Datos local (puerto 54321) en otra ventana...
start "SIGNUM - BASE DE DATOS (NO CERRAR)" cmd /k "cd /d "%~dp0" && node scripts\local-supabase\server.js"

timeout /t 3 /nobreak >nul

echo  [2/2] Iniciando el sistema web (puerto 5180)...
echo.
echo  Abra el sistema en ESTE equipo:   http://localhost:5180
echo  Desde OTRAS computadoras use:     http://IP-DE-ESTE-EQUIPO:5180
echo.
echo  IPs de este equipo:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do for /f "tokens=*" %%b in ("%%a") do echo     http://%%b:5180
echo.
echo  IMPORTANTE: no cierre ninguna de las dos ventanas mientras se use el sistema.
echo ======================================================================
echo.

call npm run dev

pause
