@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
set "CIPHER=%~1"
if "%CIPHER%"=="" (
  echo Enter base64 ciphertext ^(e.g. from request "data" field^), then press Enter:
  set /p CIPHER=""
  if "!CIPHER!"=="" (
    echo No input. Usage: decrypt-body.bat "U2FsdGVkX19..."
    pause
    exit /b 1
  )
)
node "%~dp0decrypt-body.js" "!CIPHER!"
echo.
pause
