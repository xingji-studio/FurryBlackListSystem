from __future__ import annotations

from functools import wraps

from flask import Flask, Response, abort, flash, redirect, render_template, request, session, url_for

from .config import (
    ALLOWED_PLATFORMS,
    get_admin_password,
    get_admin_password_hash,
    get_admin_username,
    get_secret_key,
    hash_password,
)
from .db import init_db
from .security import (
    apply_security_headers,
    check_rate_limit,
    generate_csrf_token,
    verify_csrf_token,
)
from .services import (
    get_blacklist_entry_image,
    get_report_image,
    approve_appeal,
    approve_report,
    list_blacklist_entries,
    list_pending_appeals,
    list_pending_reports,
    reject_appeal,
    reject_report,
)


def create_admin_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.secret_key = get_secret_key()
    app.config.update(
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
        if approve_report(report_id, admin_note):
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
