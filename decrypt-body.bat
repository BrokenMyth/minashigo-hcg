@echo off
setlocal EnableExtensions

set "CIPHER=%~1"
if "%CIPHER%"=="" (
  echo Enter base64 ciphertext (request "data" field^):
  set /p CIPHER=
)

if "%CIPHER%"=="" (
  echo No input. Usage: decrypt-body.bat "U2FsdGVkX19..."
  goto :END
)

node "%~dp0decrypt-body.js" "%CIPHER%"
if errorlevel 1 (
  echo.
  echo decrypt-body.js exited with error.
)

:END
echo.
pause
endlocal
