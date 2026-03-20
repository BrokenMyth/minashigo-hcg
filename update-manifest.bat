@echo off
setlocal EnableExtensions

node "%~dp0update-manifest.js"
if errorlevel 1 (
  echo.
  echo update-manifest.js exited with error.
)

echo.
pause
endlocal
