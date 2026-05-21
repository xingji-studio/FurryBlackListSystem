from __future__ import annotations

import tempfile
import zipfile
from datetime import timedelta
from functools import wraps
from pathlib import Path

from flask import Flask, Response, abort, flash, redirect, render_template, request, send_file, session, url_for
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import (
    ALLOWED_PLATFORMS,
    DATA_DIR,
    LOG_DIR,
    get_admin_password,
    get_admin_password_hash,
    get_admin_username,
    get_max_content_length,
    get_secret_key,
    get_trusted_proxy_count,
    hash_password,
)
from .db import create_database_backup, init_db
from .security import (
    apply_security_headers,
    check_rate_limit,
    generate_csrf_token,
    validate_threat_level,
    verify_csrf_token,
)
from .services import (
    get_blacklist_entry_image,
    get_report_image,
    approve_appeal,
    approve_report,
    delete_blacklist_entry,
    list_blacklist_entries,
    list_pending_appeals,
    list_pending_reports,
    reject_appeal,
    reject_report,
)


def create_admin_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")
    trusted_proxy_count = get_trusted_proxy_count()
    if trusted_proxy_count:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=trusted_proxy_count, x_proto=trusted_proxy_count, x_host=trusted_proxy_count)
    app.secret_key = get_secret_key()
    app.config.update(
        MAX_CONTENT_LENGTH=get_max_content_length(),
        PERMANENT_SESSION_LIFETIME=timedelta(minutes=10),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Strict",
    )
    init_db()

    @app.context_processor
    def inject_globals():
        return {
            "csrf_token": generate_csrf_token,
            "allowed_platforms": ALLOWED_PLATFORMS,
            "show_public_nav": False,
        }

    @app.after_request
    def set_security_headers(response):
        return apply_security_headers(response)

    def login_required(view_func):
        @wraps(view_func)
        def wrapped(*args, **kwargs):
            if not session.get("admin_logged_in"):
                return redirect(url_for("login"))
            session.permanent = True
            session.modified = True
            return view_func(*args, **kwargs)

        return wrapped

    @app.route("/", methods=["GET", "POST"])
    def login():
        if session.get("admin_logged_in"):
            return redirect(url_for("dashboard"))

        if request.method == "POST":
            verify_csrf_token()
            check_rate_limit("admin_login", limit=8, window_seconds=300)
            username = request.form.get("username", "")
            password = request.form.get("password", "")
            password_hash = get_admin_password_hash()
            provided_hash = hash_password(password)
            valid_password = provided_hash == password_hash if password_hash else password == get_admin_password()
            if username == get_admin_username() and valid_password:
                session.clear()
                session.permanent = True
                session["admin_logged_in"] = True
                return redirect(url_for("dashboard"))

            flash("账号或密码错误。", "error")

        return render_template("admin/login.html")

    @app.get("/dashboard")
    @login_required
    def dashboard():
        return render_template(
            "admin/dashboard.html",
            reports=list_pending_reports(),
            appeals=list_pending_appeals(),
            blacklist_entries=list_blacklist_entries(),
        )

    @app.post("/reports/<int:report_id>/approve")
    @login_required
    def handle_approve_report(report_id: int):
        verify_csrf_token()
        admin_note = request.form.get("admin_note", "")
        try:
            threat_level = validate_threat_level(request.form.get("threat_level", ""))
        except ValueError as exc:
            flash(str(exc), "error")
            return redirect(url_for("dashboard"))
        if approve_report(report_id, admin_note, threat_level):
            flash(f"举报 #{report_id} 已通过并写入黑名单。", "success")
        else:
            flash(f"举报 #{report_id} 不存在或已处理。", "error")
        return redirect(url_for("dashboard"))

    @app.post("/reports/<int:report_id>/reject")
    @login_required
    def handle_reject_report(report_id: int):
        verify_csrf_token()
        admin_note = request.form.get("admin_note", "")
        if reject_report(report_id, admin_note):
            flash(f"举报 #{report_id} 已驳回。", "success")
        else:
            flash(f"举报 #{report_id} 不存在或已处理。", "error")
        return redirect(url_for("dashboard"))

    @app.post("/appeals/<int:appeal_id>/approve")
    @login_required
    def handle_approve_appeal(appeal_id: int):
        verify_csrf_token()
        admin_note = request.form.get("admin_note", "")
        if approve_appeal(appeal_id, admin_note):
            flash(f"申诉 #{appeal_id} 已通过，黑名单记录已删除。", "success")
        else:
            flash(f"申诉 #{appeal_id} 不存在或已处理。", "error")
        return redirect(url_for("dashboard"))

    @app.post("/appeals/<int:appeal_id>/reject")
    @login_required
    def handle_reject_appeal(appeal_id: int):
        verify_csrf_token()
        admin_note = request.form.get("admin_note", "")
        if reject_appeal(appeal_id, admin_note):
            flash(f"申诉 #{appeal_id} 已驳回。", "success")
        else:
            flash(f"申诉 #{appeal_id} 不存在或已处理。", "error")
        return redirect(url_for("dashboard"))

    @app.post("/blacklist/<int:entry_id>/delete")
    @login_required
    def handle_delete_blacklist_entry(entry_id: int):
        verify_csrf_token()
        if delete_blacklist_entry(entry_id):
            flash(f"黑名单条目 #{entry_id} 已删除。", "success")
        else:
            flash(f"黑名单条目 #{entry_id} 不存在。", "error")
        return redirect(url_for("dashboard"))

    @app.get("/exports/database")
    @login_required
    def export_database():
        backup_path = _build_temp_path("blacklist-export-", ".db")
        try:
            create_database_backup(backup_path)
        except FileNotFoundError:
            flash("数据库文件不存在，无法导出。", "error")
            return redirect(url_for("dashboard"))

        return _send_temp_file(
            backup_path,
            download_name="blacklist-backup.db",
            mimetype="application/octet-stream",
        )

    @app.get("/exports/logs")
    @login_required
    def export_logs():
        log_files = [path for path in LOG_DIR.rglob("*") if path.is_file()]
        if not log_files:
            flash("当前没有可导出的日志文件。生产模式日志默认位于 data/logs/。", "error")
            return redirect(url_for("dashboard"))

        archive_path = _build_temp_path("logs-export-", ".zip")
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for log_file in log_files:
                archive.write(log_file, arcname=log_file.relative_to(LOG_DIR))

        return _send_temp_file(
            archive_path,
            download_name="server-logs.zip",
            mimetype="application/zip",
        )

    @app.post("/logout")
    @login_required
    def logout():
        verify_csrf_token()
        session.clear()
        return redirect(url_for("login"))

    @app.get("/report-images/<int:image_id>")
    @login_required
    def report_image(image_id: int):
        image = get_report_image(image_id)
        if not image:
            abort(404)
        return Response(image["image_data"], mimetype=image["mime_type"])

    @app.get("/blacklist-images/<int:image_id>")
    @login_required
    def blacklist_image(image_id: int):
        image = get_blacklist_entry_image(image_id)
        if not image:
            abort(404)
        return Response(image["image_data"], mimetype=image["mime_type"])

    return app


def _build_temp_path(prefix: str, suffix: str) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temp_file = tempfile.NamedTemporaryFile(prefix=prefix, suffix=suffix, dir=DATA_DIR, delete=False)
    temp_file.close()
    return Path(temp_file.name)


def _send_temp_file(path: Path, download_name: str, mimetype: str) -> Response:
    response = send_file(path, as_attachment=True, download_name=download_name, mimetype=mimetype)

    @response.call_on_close
    def cleanup() -> None:
        try:
            path.unlink()
        except FileNotFoundError:
            pass

    return response
