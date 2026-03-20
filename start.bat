@echo off
setlocal EnableExtensions

node "%~dp0index.js"
if errorlevel 1 (
  echo.
  echo index.js exited with error.
)

echo.
pause
endlocal
