@echo off
chcp 65001 >nul
node "%~dp0fetch-user-data.js" %*
echo.
pause
