from __future__ import annotations

import mimetypes

from flask import Flask, Response, abort, flash, jsonify, make_response, redirect, render_template, request, url_for
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import (
    ALLOWED_PLATFORMS,
    SPONSOR_IMAGE_PATH,
    get_max_content_length,
    get_secret_key,
    get_trusted_proxy_count,
)
from .db import init_db
from .security import (
    apply_security_headers,
    build_image_data_url,
    check_rate_limit,
    generate_csrf_token,
    validate_account_id,
    validate_description,
    validate_evidence,
    validate_platform,
    validate_reporter_contact,
    validate_report_images,
    validate_threat_level,
    verify_csrf_token,
)
from .services import (
    create_appeal,
    create_report,
    get_blacklist_entry_image,
    list_blacklist_entry_images,
    search_blacklist,
)


def create_public_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")
    trusted_proxy_count = get_trusted_proxy_count()
    if trusted_proxy_count:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=trusted_proxy_count, x_proto=trusted_proxy_count, x_host=trusted_proxy_count)
    app.secret_key = get_secret_key()
    app.config.update(
        MAX_CONTENT_LENGTH=get_max_content_length(),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
    )
    init_db()

    def add_api_headers(response: Response) -> Response:
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Max-Age"] = "600"
        return response

    def add_public_cache_headers(response: Response, max_age: int) -> Response:
        response.headers["Cache-Control"] = f"public, max-age={max_age}, s-maxage={max_age}"
        response.headers["X-Accel-Expires"] = str(max_age)
        return response

    def json_error(message: str, status_code: int) -> Response:
        response = jsonify({"success": False, "error": message})
        response.status_code = status_code
        response.headers["Cache-Control"] = "no-store"
        return add_api_headers(response)

    def get_api_search_params() -> tuple[str, str]:
        if request.method == "POST":
            payload = request.get_json(silent=True)
            if isinstance(payload, dict):
                raw_platform = payload.get("platform", "")
                raw_account_id = payload.get("account_id", "")
            else:
                raw_platform = request.form.get("platform", "")
                raw_account_id = request.form.get("account_id", "")
        else:
            raw_platform = request.args.get("platform", "")
            raw_account_id = request.args.get("account_id", "")

        platform = validate_platform(str(raw_platform))
        account_id = validate_account_id(str(raw_account_id))
        return platform, account_id

    def build_api_entry_payload(entry: dict) -> dict:
        images = list_blacklist_entry_images(entry["id"])
        return {
            "id": entry["id"],
            "platform": entry["platform"],
            "account_id": entry["account_id"],
            "threat_level": entry["threat_level"],
            "description": entry["description"],
            "created_at": entry["created_at"],
            "updated_at": entry["updated_at"],
            "images": [
                {
                    "id": image["id"],
                    "filename": image["filename"],
                    "mime_type": image["mime_type"],
                    "url": url_for("blacklist_image", image_id=image["id"], _external=True),
                }
                for image in images
            ],
        }

    @app.context_processor
    def inject_globals():
        return {
            "csrf_token": generate_csrf_token,
            "allowed_platforms": ALLOWED_PLATFORMS,
            "show_public_nav": True,
        }

    @app.after_request
    def set_security_headers(response):
        return apply_security_headers(response)

    @app.get("/")
    def index():
        return render_template("public/index.html")

    @app.get("/report")
    def report_form():
        return render_template("public/report.html")

    @app.post("/report")
    def submit_report():
        verify_csrf_token()
        check_rate_limit("report", limit=10, window_seconds=600)

        try:
            platform = validate_platform(request.form.get("platform", ""))
            account_id = validate_account_id(request.form.get("account_id", ""))
            threat_level = validate_threat_level(request.form.get("threat_level", ""))
            description = validate_description(request.form.get("description", ""))
            evidence = validate_evidence(request.form.get("evidence", ""))
            reporter_contact = validate_reporter_contact(request.form.get("reporter_contact", ""))
            images = validate_report_images(request.files.getlist("images"))
        except ValueError as exc:
            flash(str(exc), "error")
            return redirect(url_for("report_form"))

        create_report(platform, account_id, threat_level, description, evidence, reporter_contact, images)
        flash("举报已提交，等待管理员审核。", "success")
        return redirect(url_for("report_form"))

    @app.route("/search", methods=["GET", "POST"])
    def search():
        result = None
        searched = False
        if request.method == "POST":
            verify_csrf_token()
            check_rate_limit("search", limit=30, window_seconds=300)
            searched = True
            try:
                platform = validate_platform(request.form.get("platform", ""))
                account_id = validate_account_id(request.form.get("account_id", ""))
                result = search_blacklist(platform, account_id)
                if result:
                    full_images = list_blacklist_entry_images(result["id"])
                    result["image_cards"] = [
                        {
                            "id": image["id"],
                            "filename": image["filename"],
                            "preview_url": build_image_data_url(image["mime_type"], image["image_data"]),
                        }
                        for image in full_images
                    ]
            except ValueError as exc:
                flash(str(exc), "error")
        return render_template("public/search.html", result=result, searched=searched)

    @app.route("/api/blacklist/search", methods=["GET", "POST", "OPTIONS"])
    def api_search():
        if request.method == "OPTIONS":
            return add_api_headers(make_response("", 204))

        try:
            check_rate_limit("api_search", limit=60, window_seconds=300)
            platform, account_id = get_api_search_params()
            result = search_blacklist(platform, account_id)
        except ValueError as exc:
            return json_error(str(exc), 400)
        except HTTPException as exc:
            message = "请求过于频繁，请稍后再试。" if exc.code == 429 else str(exc.description or "请求失败。")
            return json_error(message, exc.code or 500)

        response = jsonify(
            {
                "success": True,
                "found": result is not None,
                "query": {
                    "platform": platform,
                    "account_id": account_id,
                },
                "entry": build_api_entry_payload(result) if result else None,
            }
        )
        response.headers["Cache-Control"] = "public, max-age=60, s-maxage=120" if request.method == "GET" else "no-store"
        return add_api_headers(response)

    @app.get("/appeal")
    def appeal_form():
        return render_template("public/appeal.html")

    @app.post("/appeal")
    def submit_appeal():
        verify_csrf_token()
        check_rate_limit("appeal", limit=10, window_seconds=600)

        try:
            platform = validate_platform(request.form.get("platform", ""))
            account_id = validate_account_id(request.form.get("account_id", ""))
            description = validate_description(request.form.get("description", ""))
            evidence = validate_evidence(request.form.get("evidence", ""))
        except ValueError as exc:
            flash(str(exc), "error")
            return redirect(url_for("appeal_form"))

        create_appeal(platform, account_id, description, evidence)
        flash("申诉已提交，等待管理员审核。", "success")
        return redirect(url_for("appeal_form"))

    @app.get("/blacklist-images/<int:image_id>")
    def blacklist_image(image_id: int):
        check_rate_limit("blacklist_image", limit=180, window_seconds=300)
        image = get_blacklist_entry_image(image_id)
        if not image:
            abort(404)
        response = Response(image["image_data"], mimetype=image["mime_type"])
        return add_public_cache_headers(response, max_age=300)

    @app.get("/sponsor-image")
    def sponsor_image():
        if not SPONSOR_IMAGE_PATH.exists():
            abort(404)
        mimetype, _ = mimetypes.guess_type(SPONSOR_IMAGE_PATH.name)
        response = Response(SPONSOR_IMAGE_PATH.read_bytes(), mimetype=mimetype or "image/jpeg")
        return add_public_cache_headers(response, max_age=3600)

    return app
