@echo off
setlocal EnableExtensions

node "%~dp0fetch-user-data.js" %*
if errorlevel 1 (
  echo.
  echo fetch-user-data.js exited with error.
)

echo.
pause
endlocal
