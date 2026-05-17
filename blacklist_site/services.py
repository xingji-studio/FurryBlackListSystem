from __future__ import annotations

import sqlite3
from typing import Any

from .db import get_connection


def create_report(
    platform: str,
    account_id: str,
    threat_level: str,
    description: str,
    evidence: str,
) -> None:
    connection = get_connection()
    try:
        connection.execute(
            """
            INSERT INTO reports (platform, account_id, threat_level, description, evidence)
            VALUES (?, ?, ?, ?, ?)
            """,
            (platform.strip(), account_id.strip(), threat_level.strip(), description.strip(), evidence.strip()),
        )
        connection.commit()
    finally:
        connection.close()


def create_appeal(platform: str, account_id: str, description: str, evidence: str) -> None:
    connection = get_connection()
    try:
        connection.execute(
            """
            INSERT INTO appeals (platform, account_id, description, evidence)
            VALUES (?, ?, ?, ?)
            """,
            (platform.strip(), account_id.strip(), description.strip(), evidence.strip()),
        )
        connection.commit()
    finally:
        connection.close()


def search_blacklist(platform: str, account_id: str) -> dict[str, Any] | None:
    connection = get_connection()
    try:
        return connection.execute(
            """
            SELECT id, platform, account_id, threat_level, description, created_at, updated_at
            FROM blacklist_entries
            WHERE lower(platform) = lower(?) AND lower(account_id) = lower(?)
            """,
            (platform.strip(), account_id.strip()),
        ).fetchone()
    finally:
        connection.close()


def list_pending_reports() -> list[dict[str, Any]]:
    return _list_by_status("reports", "pending")


def list_pending_appeals() -> list[dict[str, Any]]:
    return _list_by_status("appeals", "pending")


def list_blacklist_entries() -> list[dict[str, Any]]:
    connection = get_connection()
    try:
        return connection.execute(
            """
            SELECT id, platform, account_id, threat_level, description, created_at, updated_at
            FROM blacklist_entries
            ORDER BY updated_at DESC, id DESC
            """
        ).fetchall()
    finally:
        connection.close()


def approve_report(report_id: int, admin_note: str = "") -> bool:
    connection = get_connection()
    try:
        report = connection.execute(
            "SELECT * FROM reports WHERE id = ? AND status = 'pending'",
            (report_id,),
        ).fetchone()
        if not report:
            return False

        connection.execute(
            """
            INSERT INTO blacklist_entries (platform, account_id, threat_level, description, source_report_id)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(platform, account_id)
            DO UPDATE SET
                threat_level = excluded.threat_level,
                description = excluded.description,
                source_report_id = excluded.source_report_id,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                report["platform"],
                report["account_id"],
                report["threat_level"],
                report["description"],
                report["id"],
            ),
        )
        connection.execute(
            """
            UPDATE reports
            SET status = 'approved', admin_note = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (admin_note.strip(), report_id),
        )
        connection.commit()
        return True
    finally:
        connection.close()


def reject_report(report_id: int, admin_note: str = "") -> bool:
    return _update_request_status("reports", report_id, "rejected", admin_note)


def approve_appeal(appeal_id: int, admin_note: str = "") -> bool:
    connection = get_connection()
    try:
        appeal = connection.execute(
            "SELECT * FROM appeals WHERE id = ? AND status = 'pending'",
            (appeal_id,),
        ).fetchone()
        if not appeal:
            return False

        connection.execute(
            """
            DELETE FROM blacklist_entries
            WHERE lower(platform) = lower(?) AND lower(account_id) = lower(?)
            """,
            (appeal["platform"], appeal["account_id"]),
        )
        connection.execute(
            """
            UPDATE appeals
            SET status = 'approved', admin_note = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (admin_note.strip(), appeal_id),
        )
        connection.commit()
        return True
    finally:
        connection.close()


def reject_appeal(appeal_id: int, admin_note: str = "") -> bool:
    return _update_request_status("appeals", appeal_id, "rejected", admin_note)


def _list_by_status(table_name: str, status: str) -> list[dict[str, Any]]:
    connection = get_connection()
    try:
        return connection.execute(
            f"""
            SELECT *
            FROM {table_name}
            WHERE status = ?
            ORDER BY created_at ASC, id ASC
            """,
            (status,),
        ).fetchall()
    finally:
        connection.close()


def _update_request_status(table_name: str, row_id: int, status: str, admin_note: str) -> bool:
    connection = get_connection()
    try:
        cursor = connection.execute(
            f"""
            UPDATE {table_name}
            SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'pending'
            """,
            (status, admin_note.strip(), row_id),
        )
        connection.commit()
        return cursor.rowcount > 0
    finally:
        connection.close()
