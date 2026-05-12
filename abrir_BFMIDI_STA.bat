@echo off
setlocal

set "WEBAPP_DIR=%~dp0webApp"
set "ENTRY=%WEBAPP_DIR%\index.html"
set "BFMIDI_API=%~1"
if "%BFMIDI_API%"=="" set "BFMIDI_API=bfmidi.local"
set "PORT=%RANDOM%"
set /a PORT=20000 + PORT %% 30000

set "URL=http://127.0.0.1:%PORT%/index.html?api=http%%3A%%2F%%2F%BFMIDI_API%"

if not exist "%ENTRY%" (
  echo Arquivo nao encontrado:
  echo "%ENTRY%"
  pause
  exit /b 1
)

cd /d "%WEBAPP_DIR%"

where py >nul 2>nul
if %errorlevel%==0 (
  echo Abrindo BFMIDI webApp local usando API STA:
  echo %URL%
  start "BFMIDI webApp STA server" /min py -u -m http.server %PORT% --bind 127.0.0.1
  timeout /t 1 /nobreak >nul
  start "" "%URL%"
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Abrindo BFMIDI webApp local usando API STA:
  echo %URL%
  start "BFMIDI webApp STA server" /min python -u -m http.server %PORT% --bind 127.0.0.1
  timeout /t 1 /nobreak >nul
  start "" "%URL%"
  goto :eof
)

echo Python nao encontrado. Instale Python ou use outro servidor HTTP local.
echo %URL%
pause
