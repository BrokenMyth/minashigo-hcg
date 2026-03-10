@echo off
chcp 65001 >nul
node "%~dp0update-token.js"
echo.
pause
