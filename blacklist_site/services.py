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
    images: list[dict[str, str | bytes]],
) -> None:
    connection = get_connection()
    try:
        cursor = connection.execute(
            """
            INSERT INTO reports (platform, account_id, threat_level, description, evidence)
            VALUES (?, ?, ?, ?, ?)
            """,
            (platform.strip(), account_id.strip(), threat_level.strip(), description.strip(), evidence.strip()),
        )
        report_id = cursor.lastrowid
        for image in images:
            connection.execute(
                """
                INSERT INTO report_images (report_id, mime_type, filename, image_data)
                VALUES (?, ?, ?, ?)
                """,
                (report_id, image["mime_type"], image["filename"], image["image_data"]),
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
        entry = connection.execute(
            """
            SELECT id, platform, account_id, threat_level, description, created_at, updated_at
            FROM blacklist_entries
            WHERE lower(platform) = lower(?) AND lower(account_id) = lower(?)
            """,
            (platform.strip(), account_id.strip()),
        ).fetchone()
        if not entry:
            return None

        entry["images"] = connection.execute(
            """
            SELECT id, filename, mime_type
            FROM blacklist_entry_images
            WHERE blacklist_entry_id = ?
            ORDER BY id ASC
            """,
            (entry["id"],),
        ).fetchall()
        return entry
    finally:
        connection.close()


def list_pending_reports() -> list[dict[str, Any]]:
    connection = get_connection()
    try:
        reports = connection.execute(
            """
            SELECT *
            FROM reports
            WHERE status = 'pending'
            ORDER BY created_at ASC, id ASC
            """
        ).fetchall()
        for report in reports:
            report["images"] = connection.execute(
                """
                SELECT id, filename, mime_type
                FROM report_images
                WHERE report_id = ?
                ORDER BY id ASC
                """,
                (report["id"],),
            ).fetchall()
        return reports
    finally:
        connection.close()


def list_pending_appeals() -> list[dict[str, Any]]:
    return _list_by_status("appeals", "pending")


def list_blacklist_entries() -> list[dict[str, Any]]:
    connection = get_connection()
    try:
        entries = connection.execute(
            """
            SELECT id, platform, account_id, threat_level, description, created_at, updated_at
            FROM blacklist_entries
            ORDER BY updated_at DESC, id DESC
            """
        ).fetchall()
        for entry in entries:
            entry["images"] = connection.execute(
                """
                SELECT id, filename, mime_type
                FROM blacklist_entry_images
                WHERE blacklist_entry_id = ?
                ORDER BY id ASC
                """,
                (entry["id"],),
            ).fetchall()
        return entries
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

        report_images = connection.execute(
            """
            SELECT filename, mime_type, image_data
            FROM report_images
            WHERE report_id = ?
            ORDER BY id ASC
            """,
            (report_id,),
        ).fetchall()

        cursor = connection.execute(
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
        blacklist_entry = connection.execute(
            """
            SELECT id
            FROM blacklist_entries
            WHERE lower(platform) = lower(?) AND lower(account_id) = lower(?)
            """,
            (report["platform"], report["account_id"]),
        ).fetchone()
        blacklist_entry_id = blacklist_entry["id"] if blacklist_entry else cursor.lastrowid

        connection.execute(
            "DELETE FROM blacklist_entry_images WHERE blacklist_entry_id = ?",
            (blacklist_entry_id,),
        )
        for image in report_images:
            connection.execute(
                """
                INSERT INTO blacklist_entry_images (blacklist_entry_id, mime_type, filename, image_data)
                VALUES (?, ?, ?, ?)
                """,
                (blacklist_entry_id, image["mime_type"], image["filename"], image["image_data"]),
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


def get_report_image(image_id: int) -> dict[str, Any] | None:
    return _get_image(
        """
        SELECT report_images.id, report_images.filename, report_images.mime_type, report_images.image_data
        FROM report_images
        INNER JOIN reports ON reports.id = report_images.report_id
        WHERE report_images.id = ? AND reports.status = 'pending'
        """,
        image_id,
    )


def get_blacklist_entry_image(image_id: int) -> dict[str, Any] | None:
    return _get_image(
        """
        SELECT blacklist_entry_images.id, blacklist_entry_images.filename, blacklist_entry_images.mime_type, blacklist_entry_images.image_data
        FROM blacklist_entry_images
        INNER JOIN blacklist_entries ON blacklist_entries.id = blacklist_entry_images.blacklist_entry_id
        WHERE blacklist_entry_images.id = ?
        """,
        image_id,
    )


def list_blacklist_entry_images(blacklist_entry_id: int) -> list[dict[str, Any]]:
    connection = get_connection()
    try:
        return connection.execute(
            """
            SELECT id, filename, mime_type, image_data
            FROM blacklist_entry_images
            WHERE blacklist_entry_id = ?
            ORDER BY id ASC
            """,
            (blacklist_entry_id,),
        ).fetchall()
    finally:
        connection.close()


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


def _get_image(query: str, image_id: int) -> dict[str, Any] | None:
    connection = get_connection()
    try:
        return connection.execute(query, (image_id,)).fetchone()
    finally:
        connection.close()
