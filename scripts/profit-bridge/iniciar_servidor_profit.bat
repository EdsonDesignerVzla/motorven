@echo off
title PROFIT PLUS 2K8 - SERVICIO DE TIEMPO REAL
color 0B
echo ===============================================================
echo   INICIANDO SERVICIO EN TIEMPO REAL PROFIT PLUS 2K8
echo ===============================================================
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo Instalando dependencias necesarias...
    call npm install
    echo.
)

node server.js

echo.
pause
