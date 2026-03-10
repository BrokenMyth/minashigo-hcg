@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
set "SCENE_ID=%~1"
if "%SCENE_ID%"=="" (
  echo 请输入寝室场景ID（数字，如 122810112）：
  set /p SCENE_ID=""
  if "!SCENE_ID!"=="" (
    echo 未输入ID，已退出。
    pause
    exit /b 1
  )
)
node "%~dp0fetch-resources.js" %SCENE_ID% %2 %3 %4 %5
echo.
pause
