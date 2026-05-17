from __future__ import annotations

from flask import Flask, flash, redirect, render_template, request, url_for

from .config import ALLOWED_PLATFORMS, get_secret_key
from .db import init_db
from .security import (
    apply_security_headers,
    check_rate_limit,
    generate_csrf_token,
    validate_account_id,
    validate_description,
    validate_evidence,
    validate_platform,
    validate_threat_level,
    verify_csrf_token,
)
from .services import create_appeal, create_report, search_blacklist


def create_public_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.secret_key = get_secret_key()
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
    )
    init_db()

    @app.context_processor
    def inject_globals():
        return {
            "csrf_token": generate_csrf_token,
            "allowed_platforms": ALLOWED_PLATFORMS,
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
        except ValueError as exc:
            flash(str(exc), "error")
            return redirect(url_for("report_form"))

        create_report(platform, account_id, threat_level, description, evidence)
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
            except ValueError as exc:
                flash(str(exc), "error")
        return render_template("public/search.html", result=result, searched=searched)

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

    return app
