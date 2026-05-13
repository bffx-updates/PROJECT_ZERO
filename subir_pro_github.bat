@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ============================================================
echo   BFMIDI - Subir mudancas pro GitHub
echo ============================================================
echo.

REM Mostra o que mudou
echo Arquivos modificados:
git status --short
if errorlevel 1 (
  echo.
  echo ERRO: Esta pasta nao parece ser um repositorio git.
  echo.
  pause
  exit /b 1
)
echo.

REM Checa se ha algo pra commitar
for /f %%i in ('git status --porcelain ^| find /c /v ""') do set CHANGES=%%i
if "%CHANGES%"=="0" (
  echo Nada mudou desde o ultimo push. Saindo.
  echo.
  pause
  exit /b 0
)

REM Pergunta a mensagem
set "MSG="
set /p MSG=Mensagem do commit (ENTER para data/hora):
if "!MSG!"=="" (
  for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "DT=%%a"
  set "MSG=update !DT:~0,4!-!DT:~4,2!-!DT:~6,2! !DT:~8,2!:!DT:~10,2!"
)

echo.
echo Commit: "!MSG!"
echo.

git add -A
git commit -m "!MSG!"
if errorlevel 1 (
  echo.
  echo ERRO no commit. Veja a mensagem acima.
  echo.
  pause
  exit /b 1
)

echo.
echo Enviando pro GitHub...
git push
if errorlevel 1 (
  echo.
  echo ERRO no push. Possiveis causas:
  echo   - Sem internet
  echo   - Credenciais expiradas
  echo   - Algum outro push aconteceu antes (precisa git pull)
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   PRONTO! Subiu pro GitHub.
echo.
echo   Se voce mudou algo em webApp/, o GitHub Actions vai
echo   rebuild o webApp e gerar o littlefs.bin em ~2 minutos.
echo.
echo   Acompanhe em:
echo   https://github.com/bffx-updates/PROJECT_ZERO/actions
echo.
echo   Depois que ficar verde, o cliente atualiza pelo:
echo   https://bffx-updates.github.io/PROJECT_ZERO/upload_littlefs/
echo ============================================================
echo.
pause
