@echo off
setlocal

set ROOT_DIR=%~dp0
set VENV_DIR=%ROOT_DIR%.venv
set RUN_DIR=%ROOT_DIR%data\run
set LOG_DIR=%ROOT_DIR%data\logs

if "%PUBLIC_PORT%"=="" set PUBLIC_PORT=8080
if "%ADMIN_PORT%"=="" set ADMIN_PORT=8081
if "%PUBLIC_BIND%"=="" set PUBLIC_BIND=0.0.0.0:%PUBLIC_PORT%
if "%ADMIN_BIND%"=="" set ADMIN_BIND=0.0.0.0:%ADMIN_PORT%
if "%WEB_CONCURRENCY%"=="" set WEB_CONCURRENCY=4
if "%PUBLIC_WORKERS%"=="" set PUBLIC_WORKERS=%WEB_CONCURRENCY%
if "%ADMIN_WORKERS%"=="" set ADMIN_WORKERS=2
if "%GUNICORN_THREADS%"=="" set GUNICORN_THREADS=8
if "%PUBLIC_THREADS%"=="" set PUBLIC_THREADS=%GUNICORN_THREADS%
if "%ADMIN_THREADS%"=="" set ADMIN_THREADS=4

if not exist "%RUN_DIR%" mkdir "%RUN_DIR%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

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

if exist "%RUN_DIR%\public.pid" del /f /q "%RUN_DIR%\public.pid"
if exist "%RUN_DIR%\admin.pid" del /f /q "%RUN_DIR%\admin.pid"

start "furry-public" /b cmd /c "gunicorn --config \"%ROOT_DIR%gunicorn.conf.py\" --bind %PUBLIC_BIND% --workers %PUBLIC_WORKERS% --threads %PUBLIC_THREADS% --pid \"%RUN_DIR%\public.pid\" wsgi:public_app >> \"%LOG_DIR%\public.log\" 2>&1"
start "furry-admin" /b cmd /c "gunicorn --config \"%ROOT_DIR%gunicorn.conf.py\" --bind %ADMIN_BIND% --workers %ADMIN_WORKERS% --threads %ADMIN_THREADS% --pid \"%RUN_DIR%\admin.pid\" wsgi:admin_app >> \"%LOG_DIR%\admin.log\" 2>&1"

timeout /t 2 >nul

echo 公开站已启动: http://127.0.0.1:%PUBLIC_PORT%
echo 后台站已启动: http://127.0.0.1:%ADMIN_PORT%
echo 日志目录: %LOG_DIR%
