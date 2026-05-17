from __future__ import annotations

import os
import subprocess
import sys
import time

from blacklist_site.config import get_admin_port, get_public_port


def stop_processes(processes: list[subprocess.Popen]) -> None:
    for process in processes:
        if process.poll() is None:
            process.terminate()
    for process in processes:
        if process.poll() is None:
            process.wait(timeout=10)


def main() -> int:
    env = os.environ.copy()
    processes = [
        subprocess.Popen([sys.executable, "run_public.py"], env=env),
        subprocess.Popen([sys.executable, "run_admin.py"], env=env),
    ]

    print(f"公开页已启动: http://127.0.0.1:{get_public_port()}")
    print(f"后台页已启动: http://127.0.0.1:{get_admin_port()}")
    print("按 Ctrl+C 停止全部服务。")

    try:
        while True:
            for process in processes:
                if process.poll() is not None:
                    stop_processes(processes)
                    return process.returncode or 0
            time.sleep(1)
    except KeyboardInterrupt:
        stop_processes(processes)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
