@echo off
chcp 65001 >nul
setlocal
if "%~1"=="" (
  echo 用法: fetch-resources.bat ^<寝室场景ID^>
  echo 示例: fetch-resources.bat 122810112
  exit /b 1
)
node "%~dp0fetch-resources.js" %*
echo.
pause
