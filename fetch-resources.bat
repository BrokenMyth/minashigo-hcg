@echo off
setlocal EnableExtensions

set "SCENE_ID=%~1"
if "%SCENE_ID%"=="" (
  echo Enter scene ID (digits, e.g. 122810112^):
  set /p SCENE_ID=
)

if "%SCENE_ID%"=="" (
  echo No scene ID. Exit.
  goto :END
)

node "%~dp0fetch-resources.js" "%SCENE_ID%" %2 %3 %4 %5
if errorlevel 1 (
  echo.
  echo fetch-resources.js exited with error.
)

:END
echo.
pause
endlocal
