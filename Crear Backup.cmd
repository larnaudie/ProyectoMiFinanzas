@echo off
chcp 65001 >nul
title MiFinanzas - Crear backup

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\CrearBackup.ps1"

if errorlevel 1 (
  echo.
  echo El respaldo no pudo completarse.
)

echo.
pause
