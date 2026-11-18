@echo off
chcp 65001 >nul
title ConectaQuiz - Servidor local
cd /d "%~dp0"
echo ==========================================
echo          CONECTAQUIZ - INICIAR
echo ==========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo Instale a versao LTS em https://nodejs.org/
  echo Depois feche e abra esta janela novamente.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando dependencias pela primeira vez...
  call npm install
  if errorlevel 1 (
    echo.
    echo ERRO ao instalar dependencias.
    pause
    exit /b 1
  )
)
echo.
echo Servidor iniciando...
echo Quando aparecer "Servidor disponivel", abra:
echo http://localhost:3000
echo.
echo NAO feche esta janela enquanto estiver usando o quiz.
echo Para parar o servidor, pressione Ctrl+C.
echo.
call npm start
echo.
echo O servidor foi encerrado.
pause
