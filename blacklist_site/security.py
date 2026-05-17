from __future__ import annotations

import base64
import secrets
import time
from collections import deque
from typing import Any

from flask import abort, request, session

from .config import (
    ALLOWED_IMAGE_MIME_TYPES,
    ALLOWED_PLATFORMS,
    ALLOWED_THREAT_LEVELS,
    MAX_REPORT_IMAGE_COUNT,
    MAX_REPORT_IMAGE_SIZE,
)


MAX_ACCOUNT_ID_LENGTH = 64
MAX_DESCRIPTION_LENGTH = 2000
MAX_EVIDENCE_LENGTH = 4000
CSRF_SESSION_KEY = "_csrf_token"

_RATE_LIMIT_BUCKETS: dict[str, deque[float]] = {}


def normalize_text(value: str) -> str:
    return " ".join(value.strip().split())


def validate_platform(platform: str) -> str:
    normalized = normalize_text(platform)
    if normalized not in ALLOWED_PLATFORMS:
        raise ValueError("平台选项无效。")
    return normalized


def validate_threat_level(threat_level: str) -> str:
    normalized = normalize_text(threat_level)
    if normalized not in ALLOWED_THREAT_LEVELS:
        raise ValueError("威胁程度选项无效。")
    return normalized


def validate_account_id(account_id: str) -> str:
    normalized = normalize_text(account_id)
    if not normalized:
        raise ValueError("账号 ID 不能为空。")
    if len(normalized) > MAX_ACCOUNT_ID_LENGTH:
        raise ValueError(f"账号 ID 不能超过 {MAX_ACCOUNT_ID_LENGTH} 个字符。")
    return normalized


def validate_description(description: str) -> str:
    normalized = description.strip()
    if not normalized:
        raise ValueError("描述不能为空。")
    if len(normalized) > MAX_DESCRIPTION_LENGTH:
        raise ValueError(f"描述不能超过 {MAX_DESCRIPTION_LENGTH} 个字符。")
    return normalized


def validate_evidence(evidence: str) -> str:
    normalized = evidence.strip()
    if not normalized:
        raise ValueError("证据不能为空。")
    if len(normalized) > MAX_EVIDENCE_LENGTH:
        raise ValueError(f"证据不能超过 {MAX_EVIDENCE_LENGTH} 个字符。")
    return normalized


def validate_report_images(files: list[Any]) -> list[dict[str, str | bytes]]:
    valid_files = [file for file in files if getattr(file, "filename", "")]
    if len(valid_files) > MAX_REPORT_IMAGE_COUNT:
        raise ValueError(f"最多只能上传 {MAX_REPORT_IMAGE_COUNT} 张图片。")

    images: list[dict[str, str | bytes]] = []
    for file in valid_files:
        mime_type = getattr(file, "mimetype", "")
        if mime_type not in ALLOWED_IMAGE_MIME_TYPES:
            raise ValueError("只允许上传 JPG、PNG、WEBP 或 GIF 图片。")

        image_data = file.read()
        file.stream.seek(0)
        if not image_data:
            raise ValueError("上传的图片为空。")
        if len(image_data) > MAX_REPORT_IMAGE_SIZE:
            raise ValueError(f"单张图片不能超过 {MAX_REPORT_IMAGE_SIZE // (1024 * 1024)} MB。")

        images.append(
            {
                "filename": file.filename,
                "mime_type": mime_type,
                "image_data": image_data,
            }
        )

    return images


def build_image_data_url(mime_type: str, image_data: bytes) -> str:
    encoded = base64.b64encode(image_data).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def generate_csrf_token() -> str:
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_urlsafe(32)
        session[CSRF_SESSION_KEY] = token
    return token


def verify_csrf_token() -> None:
    session_token = session.get(CSRF_SESSION_KEY)
    request_token = request.form.get("csrf_token", "")
    if not session_token or not request_token or not secrets.compare_digest(session_token, request_token):
        abort(400)


def check_rate_limit(scope: str, limit: int, window_seconds: int) -> None:
    forwarded_for = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    client_ip = forwarded_for or request.remote_addr or "unknown"
    bucket_key = f"{scope}:{client_ip}"
    now = time.time()
    bucket = _RATE_LIMIT_BUCKETS.setdefault(bucket_key, deque())

    while bucket and now - bucket[0] > window_seconds:
        bucket.popleft()

    if len(bucket) >= limit:
        abort(429)

    bucket.append(now)


def apply_security_headers(response: Any) -> Any:
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "form-action 'self'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'"
    )
    return response
