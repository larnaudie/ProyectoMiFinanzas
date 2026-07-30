@echo off
chcp 65001 >nul
title MiFinanzas - Restaurar backup

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\RestaurarBackup.ps1"

if errorlevel 1 (
  echo.
  echo La restauracion no pudo completarse.
)

echo.
pause
