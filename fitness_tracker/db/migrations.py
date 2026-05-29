from __future__ import annotations

import shutil
import sqlite3
from pathlib import Path
from typing import List, Sequence

from fitness_tracker.config import AppConfig, prepare_database_file
from fitness_tracker.db.connection import connect
from fitness_tracker.utils.time import backup_timestamp, seconds_between, utc_now


CURRENT_VERSION = "20260521_001_session_duration"


def migrate(config: AppConfig) -> None:
    prepare_database_file(config)
    backup_needed = False
    if config.db_path.exists():
        with connect(config.db_path) as db:
            backup_needed = _needs_rebuild(db)
    if backup_needed:
        _copy_pre_migration_backup(config.db_path, config.backups_dir)
    with connect(config.db_path) as db:
        _ensure_schema_migrations(db)
        if not _table_exists(db, "sessions"):
            _create_current_schema(db)
        elif _needs_rebuild(db):
            _rebuild_sessions_table(db)
            _create_current_schema(db)
        else:
            _create_current_schema(db)
        _ensure_deleted_at_column(db)
        _ensure_session_duration_columns(db)
        _record_migration(db, CURRENT_VERSION)
        _verify_integrity(db)


def _copy_pre_migration_backup(db_path: Path, backups_dir: Path) -> Path:
    backups_dir.mkdir(parents=True, exist_ok=True)
    destination = backups_dir / f"pre_migration_{backup_timestamp()}.sqlite3"
    shutil.copy2(db_path, destination)
    return destination


def _create_current_schema(db: sqlite3.Connection) -> None:
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            workout_key TEXT NOT NULL,
            session_no INTEGER NOT NULL,
            started_at TEXT NOT NULL,
            completed_at TEXT,
            elapsed_seconds INTEGER NOT NULL DEFAULT 0,
            running_since TEXT,
            deleted_at TEXT,
            notes TEXT NOT NULL DEFAULT '',
            UNIQUE(date, workout_key, session_no)
        );

        CREATE TABLE IF NOT EXISTS sets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            exercise_id TEXT NOT NULL,
            set_index INTEGER NOT NULL,
            weight REAL,
            reps INTEGER,
            rir INTEGER,
            completed INTEGER NOT NULL DEFAULT 0,
            completed_at TEXT,
            FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE,
            UNIQUE(session_id, exercise_id, set_index)
        );

        CREATE TABLE IF NOT EXISTS exercise_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            exercise_id TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE,
            UNIQUE(session_id, exercise_id)
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_date_started
            ON sessions(date DESC, started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sessions_date_workout
            ON sessions(date, workout_key, session_no);
        CREATE INDEX IF NOT EXISTS idx_sets_session
            ON sets(session_id, exercise_id);
        """
    )


def _ensure_schema_migrations(db: sqlite3.Connection) -> None:
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        )
        """
    )


def _record_migration(db: sqlite3.Connection, version: str) -> None:
    db.execute(
        """
        INSERT OR IGNORE INTO schema_migrations(version, applied_at)
        VALUES (?, ?)
        """,
        (version, utc_now()),
    )


def _needs_rebuild(db: sqlite3.Connection) -> bool:
    if not _table_exists(db, "sessions"):
        return False
    columns = _table_columns(db, "sessions")
    if "session_no" not in columns:
        return True
    unique_indexes = _unique_indexes(db, "sessions")
    if ("date", "workout_key") in unique_indexes:
        return True
    return ("date", "workout_key", "session_no") not in unique_indexes


def _rebuild_sessions_table(db: sqlite3.Connection) -> None:
    old_columns = _table_columns(db, "sessions")
    selected_columns = ["id", "date", "workout_key", "started_at", "completed_at", "notes"]
    if "session_no" in old_columns:
        selected_columns.append("session_no")
    if "deleted_at" in old_columns:
        selected_columns.append("deleted_at")
    if "elapsed_seconds" in old_columns:
        selected_columns.append("elapsed_seconds")
    if "running_since" in old_columns:
        selected_columns.append("running_since")
    rows = db.execute(
        f"""
        SELECT {", ".join(selected_columns)}
        FROM sessions
        ORDER BY date, workout_key, started_at, id
        """
    ).fetchall()

    db.commit()
    db.execute("PRAGMA foreign_keys = OFF")
    try:
        db.execute("DROP TABLE IF EXISTS sessions_new")
        db.execute(
            """
            CREATE TABLE sessions_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                workout_key TEXT NOT NULL,
                session_no INTEGER NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                elapsed_seconds INTEGER NOT NULL DEFAULT 0,
                running_since TEXT,
                deleted_at TEXT,
                notes TEXT NOT NULL DEFAULT '',
                UNIQUE(date, workout_key, session_no)
            )
            """
        )

        counters = {}
        used_numbers = {}
        for row in rows:
            key = (row["date"], row["workout_key"])
            used = used_numbers.setdefault(key, set())
            if "session_no" in row.keys() and row["session_no"] and int(row["session_no"]) not in used:
                session_no = int(row["session_no"])
            else:
                counters[key] = counters.get(key, 0) + 1
                while counters[key] in used:
                    counters[key] += 1
                session_no = counters[key]
            used.add(session_no)
            counters[key] = max(counters.get(key, 0), session_no)
            db.execute(
                """
                INSERT INTO sessions_new(
                    id, date, workout_key, session_no, started_at, completed_at,
                    elapsed_seconds, running_since, deleted_at, notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row["id"],
                    row["date"],
                    row["workout_key"],
                    session_no,
                    row["started_at"],
                    row["completed_at"],
                    row["elapsed_seconds"] if "elapsed_seconds" in row.keys() else 0,
                    row["running_since"] if "running_since" in row.keys() else None,
                    row["deleted_at"] if "deleted_at" in row.keys() else None,
                    row["notes"] or "",
                ),
            )

        db.execute("DROP TABLE sessions")
        db.execute("ALTER TABLE sessions_new RENAME TO sessions")
        max_id = db.execute("SELECT COALESCE(MAX(id), 0) FROM sessions").fetchone()[0]
        db.execute(
            """
            INSERT OR REPLACE INTO sqlite_sequence(name, seq)
            VALUES ('sessions', ?)
            """,
            (max_id,),
        )
        db.commit()
    finally:
        db.execute("PRAGMA foreign_keys = ON")


def _ensure_deleted_at_column(db: sqlite3.Connection) -> None:
    if _table_exists(db, "sessions") and "deleted_at" not in _table_columns(db, "sessions"):
        db.execute("ALTER TABLE sessions ADD COLUMN deleted_at TEXT")


def _ensure_session_duration_columns(db: sqlite3.Connection) -> None:
    if not _table_exists(db, "sessions"):
        return
    columns = _table_columns(db, "sessions")
    added = False
    if "elapsed_seconds" not in columns:
        db.execute("ALTER TABLE sessions ADD COLUMN elapsed_seconds INTEGER NOT NULL DEFAULT 0")
        added = True
    if "running_since" not in columns:
        db.execute("ALTER TABLE sessions ADD COLUMN running_since TEXT")
        added = True
    _backfill_session_duration(db)


def _backfill_session_duration(db: sqlite3.Connection) -> None:
    now = utc_now()
    rows = db.execute(
        """
        SELECT id, started_at, completed_at, elapsed_seconds, running_since
        FROM sessions
        """
    ).fetchall()
    for row in rows:
        elapsed = int(row["elapsed_seconds"] or 0)
        running_since = row["running_since"]
        if row["completed_at"]:
            parsed_elapsed = seconds_between(row["started_at"], row["completed_at"])
            elapsed = parsed_elapsed if parsed_elapsed is not None else elapsed
            running_since = None
        elif not running_since:
            running_since = now
        db.execute(
            """
            UPDATE sessions
            SET elapsed_seconds = ?, running_since = ?
            WHERE id = ?
            """,
            (elapsed, running_since, row["id"]),
        )


def _verify_integrity(db: sqlite3.Connection) -> None:
    integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        raise RuntimeError(f"SQLite integrity_check failed: {integrity}")
    foreign_key_errors = db.execute("PRAGMA foreign_key_check").fetchall()
    if foreign_key_errors:
        raise RuntimeError(f"SQLite foreign_key_check failed: {foreign_key_errors}")


def _table_exists(db: sqlite3.Connection, table: str) -> bool:
    row = db.execute(
        """
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
        """,
        (table,),
    ).fetchone()
    return row is not None


def _table_columns(db: sqlite3.Connection, table: str) -> List[str]:
    return [row["name"] for row in db.execute(f"PRAGMA table_info({table})").fetchall()]


def _unique_indexes(db: sqlite3.Connection, table: str) -> List[Sequence[str]]:
    indexes = []
    for index in db.execute(f"PRAGMA index_list({table})").fetchall():
        if not index["unique"]:
            continue
        columns = tuple(row["name"] for row in db.execute(f"PRAGMA index_info({index['name']})").fetchall())
        indexes.append(columns)
    return indexes
