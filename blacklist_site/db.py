from __future__ import annotations

import sqlite3
from pathlib import Path

from .config import DATABASE_PATH


def dict_factory(cursor: sqlite3.Cursor, row: tuple) -> dict:
    return {column[0]: row[index] for index, column in enumerate(cursor.description)}


def get_connection() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=30)
    connection.row_factory = dict_factory
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 10000")
    return connection


def init_db() -> None:
    connection = get_connection()
    try:
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute("PRAGMA synchronous = FULL")
        connection.execute("PRAGMA temp_store = DEFAULT")
        connection.execute("PRAGMA mmap_size = 0")
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS blacklist_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                account_id TEXT NOT NULL,
                threat_level TEXT NOT NULL,
                description TEXT NOT NULL,
                source_report_id INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(platform, account_id)
            );

            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                account_id TEXT NOT NULL,
                threat_level TEXT NOT NULL,
                description TEXT NOT NULL,
                evidence TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                admin_note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS report_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id INTEGER NOT NULL,
                mime_type TEXT NOT NULL,
                filename TEXT NOT NULL,
                image_data BLOB NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS blacklist_entry_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                blacklist_entry_id INTEGER NOT NULL,
                mime_type TEXT NOT NULL,
                filename TEXT NOT NULL,
                image_data BLOB NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(blacklist_entry_id) REFERENCES blacklist_entries(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS appeals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                account_id TEXT NOT NULL,
                description TEXT NOT NULL,
                evidence TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                admin_note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS rate_limit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scope TEXT NOT NULL,
                client_ip TEXT NOT NULL,
                request_key TEXT NOT NULL,
                created_at REAL NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_blacklist_entries_lookup
            ON blacklist_entries(platform, account_id);

            CREATE INDEX IF NOT EXISTS idx_blacklist_entries_updated
            ON blacklist_entries(updated_at DESC, id DESC);

            CREATE INDEX IF NOT EXISTS idx_reports_status_created
            ON reports(status, created_at, id);

            CREATE INDEX IF NOT EXISTS idx_appeals_status_created
            ON appeals(status, created_at, id);

            CREATE INDEX IF NOT EXISTS idx_report_images_report_id
            ON report_images(report_id, id);

            CREATE INDEX IF NOT EXISTS idx_blacklist_entry_images_entry_id
            ON blacklist_entry_images(blacklist_entry_id, id);

            CREATE INDEX IF NOT EXISTS idx_rate_limit_scope_ip_time
            ON rate_limit_events(scope, client_ip, created_at);

            CREATE INDEX IF NOT EXISTS idx_rate_limit_request_key
            ON rate_limit_events(request_key);
            """
        )
    finally:
        connection.close()


def create_database_backup(target_path: Path) -> Path:
    if not DATABASE_PATH.exists():
        raise FileNotFoundError(DATABASE_PATH)

    target_path.parent.mkdir(parents=True, exist_ok=True)
    source = get_connection()
    backup = sqlite3.connect(target_path)
    try:
        source.backup(backup)
        backup.commit()
        return target_path
    finally:
        backup.close()
        source.close()
