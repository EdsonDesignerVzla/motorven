@echo off
title SIGNUM MOTORVEN - SERVIDOR EMPRESARIAL 24/7
color 0A
cd /d "%~dp0"
cls
echo ======================================================================
echo    SIGNUM MOTORVEN - SERVIDOR PRINCIPAL DE LA EMPRESA 24/7
echo ======================================================================
echo.
echo  [+] Iniciando Base de Datos Local y Tunel Permanente con Reconexion...
echo.

node scripts\tunnel\start-server-tunnel.js

echo.
echo ======================================================================
echo  Servidor detenido. Presione cualquier tecla para reiniciar...
echo ======================================================================
pause
goto :EOF
