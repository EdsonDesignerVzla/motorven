@echo off
title Sincronizador Profit Plus 2K8 -> SIGNUM MOTORVEN
color 0A
echo ===============================================================
echo   SINCRONIZANDO PROFIT PLUS 2K8 CON SIGNUM MOTORVEN (SUPABASE)
echo ===============================================================
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo Instalando dependencias necesarias (mssql, supabase)...
    call npm install
    echo.
)

node syncProfitToSupabase.js

echo.
echo ===============================================================
echo Presiona cualquier tecla para finalizar...
pause >nul
