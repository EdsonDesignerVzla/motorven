@echo off
title Diagnostico de Conexion: Profit Plus 2K8 -> SIGNUM MOTORVEN
color 0B
echo ===============================================================
echo   PROBANDO CONEXION CON PROFIT PLUS 2K8 Y SUPABASE
echo ===============================================================
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo Instalando dependencias necesarias (mssql, supabase)...
    call npm install
    echo.
)

node testConnection.js

echo.
echo Presiona cualquier tecla para cerrar...
pause >nul
