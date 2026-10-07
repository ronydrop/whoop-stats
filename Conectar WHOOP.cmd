@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-local.ps1" -Acao conectar
if errorlevel 1 pause
