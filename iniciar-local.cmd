@echo off
rem Permite iniciar la aplicacion con doble clic, sin cambiar la politica del sistema.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar-local.ps1" %*
if errorlevel 1 pause
