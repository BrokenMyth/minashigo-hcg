@echo off
setlocal EnableExtensions

node "%~dp0update-token.js"
if errorlevel 1 (
  echo.
  echo update-token.js exited with error.
)

echo.
pause
endlocal
