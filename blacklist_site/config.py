from __future__ import annotations

import hashlib
import os
import secrets
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATABASE_PATH = DATA_DIR / "blacklist.db"
ENV_FILE = BASE_DIR / ".env"
SPONSOR_IMAGE_PATH = BASE_DIR / "paymefifty.jpg"
ALLOWED_PLATFORMS = ("QQ", "微信", "B站", "快手", "抖音", "Discord")
ALLOWED_THREAT_LEVELS = ("低", "中", "高", "严重")
ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_REPORT_IMAGE_COUNT = 4
MAX_REPORT_IMAGE_SIZE = 5 * 1024 * 1024
DEFAULT_MAX_CONTENT_LENGTH = 6 * 1024 * 1024


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


def get_trusted_proxy_count() -> int:
    return max(0, int(os.environ.get("TRUSTED_PROXY_COUNT", "1")))


def get_max_content_length() -> int:
    return max(1024, int(os.environ.get("MAX_CONTENT_LENGTH", str(DEFAULT_MAX_CONTENT_LENGTH))))


def get_rate_limit_max_entries() -> int:
    return max(1000, int(os.environ.get("RATE_LIMIT_MAX_ENTRIES", "20000")))
