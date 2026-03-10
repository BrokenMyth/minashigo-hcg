@echo off
chcp 65001 >nul
node "%~dp0index.js"
echo.
pause
