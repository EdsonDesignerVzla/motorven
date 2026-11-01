@echo off
title SERVIDOR LOCAL SUPABASE - SIGNUM MOTORVEN
color 0A
cls
echo ======================================================================
echo    SIGNUM MOTORVEN - SERVIDOR LOCAL SUPABASE (100%% GRATUITO Y SIN TOKEN)
echo ======================================================================
echo.
echo  [+] Iniciando Base de Datos y API REST PostgREST en Puerto 54321...
echo  [+] Persistencia local activada en supabase\local_database.json
echo  [+] 32 Tablas cargadas con datos reales de produccion
echo.
echo  - Supabase Studio Web:  http://localhost:54321/
echo  - Endpoint REST API:    http://localhost:54321/rest/v1/
echo.
echo ======================================================================
echo.

node scripts\local-supabase\server.js

pause
