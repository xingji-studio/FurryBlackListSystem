#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$ROOT_DIR/.venv"
RUN_DIR="$ROOT_DIR/data/run"
LOG_DIR="$ROOT_DIR/data/logs"

PUBLIC_BIND="${PUBLIC_BIND:-0.0.0.0:${PUBLIC_PORT:-8080}}"
ADMIN_BIND="${ADMIN_BIND:-0.0.0.0:${ADMIN_PORT:-8081}}"
PUBLIC_WORKERS="${PUBLIC_WORKERS:-${WEB_CONCURRENCY:-4}}"
ADMIN_WORKERS="${ADMIN_WORKERS:-2}"
PUBLIC_THREADS="${PUBLIC_THREADS:-${GUNICORN_THREADS:-8}}"
ADMIN_THREADS="${ADMIN_THREADS:-4}"

mkdir -p "$RUN_DIR" "$LOG_DIR"

if ! command -v python3 >/dev/null 2>&1; then
  echo "未找到 python3，请先安装 Python 3.10+"
  exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
pip install --upgrade pip
pip install -r "$ROOT_DIR/requirements.txt"

stop_if_running() {
  local pid_file="$1"
  if [ -f "$pid_file" ]; then
    local pid
    pid="$(cat "$pid_file")"
    if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

stop_if_running "$RUN_DIR/public.pid"
stop_if_running "$RUN_DIR/admin.pid"

nohup gunicorn \
  --config "$ROOT_DIR/gunicorn.conf.py" \
  --bind "$PUBLIC_BIND" \
  --workers "$PUBLIC_WORKERS" \
  --threads "$PUBLIC_THREADS" \
  --pid "$RUN_DIR/public.pid" \
  wsgi:public_app >"$LOG_DIR/public.log" 2>&1 &

nohup gunicorn \
  --config "$ROOT_DIR/gunicorn.conf.py" \
  --bind "$ADMIN_BIND" \
  --workers "$ADMIN_WORKERS" \
  --threads "$ADMIN_THREADS" \
  --pid "$RUN_DIR/admin.pid" \
  wsgi:admin_app >"$LOG_DIR/admin.log" 2>&1 &

sleep 2

echo "公开站已启动: http://127.0.0.1:${PUBLIC_PORT:-8080}"
echo "后台站已启动: http://127.0.0.1:${ADMIN_PORT:-8081}"
echo "日志目录: $LOG_DIR"
echo "停止命令: $ROOT_DIR/stop_production.sh"
