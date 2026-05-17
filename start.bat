@echo off
setlocal

set ROOT_DIR=%~dp0
set VENV_DIR=%ROOT_DIR%.venv

where py >nul 2>nul
if %errorlevel% neq 0 (
  echo 未找到 Python Launcher ^(py^)，请先安装 Python 3.10+
  exit /b 1
)

if not exist "%VENV_DIR%" (
  py -3 -m venv "%VENV_DIR%"
)

call "%VENV_DIR%\Scripts\activate.bat"
python -m pip install --upgrade pip
python -m pip install -r "%ROOT_DIR%requirements.txt"
python "%ROOT_DIR%start_servers.py"
