@echo off
chcp 65001 >nul
node "%~dp0update-manifest.js"
echo.
pause
