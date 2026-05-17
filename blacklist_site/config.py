from __future__ import annotations

import hashlib
import os
import secrets
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATABASE_PATH = DATA_DIR / "blacklist.db"
ENV_FILE = BASE_DIR / ".env"
ALLOWED_PLATFORMS = ("QQ", "微信", "B站", "快手", "抖音", "Discord")
ALLOWED_THREAT_LEVELS = ("低", "中", "高", "严重")


def load_env_file() -> None:
    if not ENV_FILE.exists():
        return

    for raw_line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_env_file()


def get_secret_key() -> str:
    return os.environ.get("SECRET_KEY", f"dev-{secrets.token_hex(32)}")


def get_admin_username() -> str:
    return os.environ.get("ADMIN_USERNAME", "admin")


def get_admin_password() -> str:
    return os.environ.get("ADMIN_PASSWORD", "admin123456")


def get_admin_password_hash() -> str:
    return os.environ.get("ADMIN_PASSWORD_HASH", "")


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def get_public_port() -> int:
    return int(os.environ.get("PUBLIC_PORT", "8080"))


def get_admin_port() -> int:
    return int(os.environ.get("ADMIN_PORT", "8081"))
