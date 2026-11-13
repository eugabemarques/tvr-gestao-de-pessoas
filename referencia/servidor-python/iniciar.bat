@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv (
  echo Preparando o ambiente pela primeira vez...
  py -3 -m venv .venv || (echo Instale o Python 3.11 ou mais novo em python.org e tente de novo. & pause & exit /b 1)
  .venv\Scripts\python -m pip install --upgrade pip >nul
  .venv\Scripts\pip install -r requirements.txt || (pause & exit /b 1)
)
.venv\Scripts\python gerenciar.py listar | findstr /r "." >nul
if errorlevel 1 (
  echo.
  echo Nenhum usuario cadastrado. Vamos criar o primeiro administrador.
  set /p LOGIN=Usuario ^(ex.: gabriel^): 
  set /p NOME=Nome completo: 
  call .venv\Scripts\python gerenciar.py criar-usuario %%LOGIN%% "%%NOME%%" --admin
)
echo.
echo TOVERI rodando em http://localhost:8080  (feche esta janela para parar)
start "" http://localhost:8080
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8080
