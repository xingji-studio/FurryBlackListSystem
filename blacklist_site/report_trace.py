from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Request

from .config import REPORT_TRACE_DIR
from .security import get_client_ip


SENSITIVE_HEADERS = {
    "authorization",
    "cookie",
    "proxy-authorization",
    "set-cookie",
}


def build_report_trace_payload(
    report_id: int,
    platform: str,
    account_id: str,
    threat_level: str,
    description: str,
    evidence: str,
    images: list[dict[str, str | bytes]],
    http_request: Request,
) -> dict[str, Any]:
    captured_at = datetime.now(timezone.utc)
    content_length = http_request.content_length

    return {
        "report_id": report_id,
        "captured_at_utc": captured_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "report_summary": {
            "platform": platform,
            "account_id": account_id,
            "threat_level": threat_level,
            "description_length": len(description),
            "evidence_length": len(evidence),
        },
        "network": {
            "client_ip": get_client_ip(),
            "remote_addr": http_request.remote_addr or "",
            "remote_port": str(http_request.environ.get("REMOTE_PORT", "")),
            "access_route": list(http_request.access_route),
            "host": http_request.host,
            "scheme": http_request.scheme,
            "url_root": http_request.url_root,
            "forwarded_for": http_request.headers.get("X-Forwarded-For", ""),
            "forwarded": http_request.headers.get("Forwarded", ""),
            "x_real_ip": http_request.headers.get("X-Real-IP", ""),
            "x_forwarded_proto": http_request.headers.get("X-Forwarded-Proto", ""),
            "x_forwarded_host": http_request.headers.get("X-Forwarded-Host", ""),
        },
        "request": {
            "method": http_request.method,
            "path": http_request.path,
            "full_path": http_request.full_path,
            "query_string": http_request.query_string.decode("utf-8", errors="replace"),
            "content_type": http_request.content_type or "",
            "content_length": int(content_length) if content_length is not None else None,
            "mimetype": http_request.mimetype or "",
            "referrer": http_request.referrer or "",
            "origin": http_request.headers.get("Origin", ""),
            "user_agent": http_request.user_agent.string,
            "accept_mimetypes": list(http_request.accept_mimetypes),
            "accept_languages": list(http_request.accept_languages),
            "accept_charsets": list(http_request.accept_charsets),
            "headers": _sanitize_headers(dict(http_request.headers.items())),
            "environ": _selected_environ(http_request.environ),
        },
        "upload_summary": {
            "image_count": len(images),
            "images": [_build_image_summary(image) for image in images],
        },
    }


def write_report_trace(trace_payload: dict[str, Any]) -> Path:
    REPORT_TRACE_DIR.mkdir(parents=True, exist_ok=True)
    report_id = int(trace_payload["report_id"])
    timestamp = str(trace_payload.get("captured_at_utc", "")).replace("-", "").replace(":", "")
    timestamp = timestamp.replace("T", "-").replace("Z", "Z") or "unknown-time"
    target_path = REPORT_TRACE_DIR / f"report-{report_id:06d}-{timestamp}.json"

    encoded = (json.dumps(trace_payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    fd = os.open(target_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(encoded)
    except Exception:
        try:
            target_path.unlink()
        except FileNotFoundError:
            pass
        raise

    return target_path


def list_report_trace_files() -> list[Path]:
    if not REPORT_TRACE_DIR.exists():
        return []
    return sorted((path for path in REPORT_TRACE_DIR.rglob("*.json") if path.is_file()), key=lambda path: path.name)


def _sanitize_headers(headers: dict[str, str]) -> dict[str, str]:
    return {
        key: value
        for key, value in headers.items()
        if key.strip().lower() not in SENSITIVE_HEADERS
    }


def _selected_environ(environ: dict[str, Any]) -> dict[str, str]:
    keys = (
        "REMOTE_ADDR",
        "REMOTE_PORT",
        "REQUEST_METHOD",
        "PATH_INFO",
        "QUERY_STRING",
        "REQUEST_URI",
        "SERVER_NAME",
        "SERVER_PORT",
        "SERVER_PROTOCOL",
        "HTTP_HOST",
        "HTTP_REFERER",
        "HTTP_ORIGIN",
        "HTTP_X_FORWARDED_FOR",
        "HTTP_X_REAL_IP",
        "HTTP_X_FORWARDED_PROTO",
        "HTTP_X_FORWARDED_HOST",
        "CONTENT_TYPE",
        "CONTENT_LENGTH",
    )
    return {key: str(environ.get(key, "")) for key in keys if key in environ}


def _build_image_summary(image: dict[str, str | bytes]) -> dict[str, Any]:
    image_data = image["image_data"]
    if not isinstance(image_data, bytes):
        raise TypeError("image_data must be bytes.")

    return {
        "filename": str(image["filename"]),
        "mime_type": str(image["mime_type"]),
        "size_bytes": len(image_data),
        "sha256": hashlib.sha256(image_data).hexdigest(),
    }
