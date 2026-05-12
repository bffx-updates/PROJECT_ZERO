@echo off
setlocal
set "WEBAPP_DIR=%~dp0webApp"
set "ENTRY=%WEBAPP_DIR%\index.html"
set "PORT=%RANDOM%"
set /a PORT=20000 + PORT %% 30000
set "URL=http://127.0.0.1:%PORT%/index.html"

if not exist "%ENTRY%" (
  echo Arquivo nao encontrado:
  echo "%ENTRY%"
  pause
  exit /b 1
)

cd /d "%WEBAPP_DIR%"

where py >nul 2>nul
if %errorlevel%==0 (
  echo Abrindo BFMIDI webApp em:
  echo %URL%
  start "BFMIDI webApp server" /min py -u -m http.server %PORT% --bind 127.0.0.1
  timeout /t 1 /nobreak >nul
  start "" "%URL%"
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Abrindo BFMIDI webApp em:
  echo %URL%
  start "BFMIDI webApp server" /min python -u -m http.server %PORT% --bind 127.0.0.1
  timeout /t 1 /nobreak >nul
  start "" "%URL%"
  goto :eof
)

echo Python nao encontrado. Instale Python ou use outro servidor HTTP local.
pause
