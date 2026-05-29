from __future__ import annotations

import sqlite3
from typing import List, Optional

from fitness_tracker.db.connection import row_to_dict
from fitness_tracker.utils.time import utc_now


def next_session_no(db: sqlite3.Connection, date: str, workout_key: str) -> int:
    row = db.execute(
        """
        SELECT COALESCE(MAX(session_no), 0) + 1 AS next_no
        FROM sessions
        WHERE date = ? AND workout_key = ?
        """,
        (date, workout_key),
    ).fetchone()
    return int(row["next_no"])


def create_session(db: sqlite3.Connection, date: str, workout_key: str, now: str | None = None) -> dict:
    session_no = next_session_no(db, date, workout_key)
    created_at = now or utc_now()
    cursor = db.execute(
        """
        INSERT INTO sessions(date, workout_key, session_no, started_at, elapsed_seconds, running_since)
        VALUES (?, ?, ?, ?, 0, ?)
        """,
        (date, workout_key, session_no, created_at, created_at),
    )
    return get_session(db, int(cursor.lastrowid))


def get_session(db: sqlite3.Connection, session_id: int) -> Optional[dict]:
    row = db.execute(
        """
        SELECT *
        FROM sessions
        WHERE id = ? AND deleted_at IS NULL
        """,
        (session_id,),
    ).fetchone()
    if not row:
        return None
    session = row_to_dict(row)
    for visible in list_sessions(db, session["date"], session["workout_key"]):
        if int(visible["id"]) == int(session_id):
            session["display_no"] = visible["display_no"]
            break
    return session


def list_sessions(db: sqlite3.Connection, date: str, workout_key: str) -> List[dict]:
    rows = db.execute(
        """
        SELECT *
        FROM sessions
        WHERE date = ? AND workout_key = ? AND deleted_at IS NULL
        ORDER BY session_no ASC, started_at ASC, id ASC
        """,
        (date, workout_key),
    ).fetchall()
    return with_display_numbers([row_to_dict(row) for row in rows])


def with_display_numbers(sessions: List[dict]) -> List[dict]:
    for index, session in enumerate(sessions, start=1):
        session["display_no"] = index
    return sessions


def find_previous_session(db: sqlite3.Connection, session: dict) -> Optional[dict]:
    row = db.execute(
        """
        SELECT *
        FROM sessions
        WHERE deleted_at IS NULL
            AND workout_key = ?
            AND id <> ?
            AND (
                date < ?
                OR (
                    date = ?
                    AND (
                        started_at < ?
                        OR (started_at = ? AND id < ?)
                    )
                )
            )
        ORDER BY date DESC, started_at DESC, id DESC
        LIMIT 1
        """,
        (
            session["workout_key"],
            session["id"],
            session["date"],
            session["date"],
            session["started_at"],
            session["started_at"],
            session["id"],
        ),
    ).fetchone()
    if not row:
        return None
    previous = row_to_dict(row)
    for visible in list_sessions(db, previous["date"], previous["workout_key"]):
        if int(visible["id"]) == int(previous["id"]):
            previous["display_no"] = visible["display_no"]
            break
    return previous


def set_completion_state(
    db: sqlite3.Connection,
    session_id: int,
    completed_at: Optional[str],
    elapsed_seconds: int,
    running_since: Optional[str],
) -> dict:
    db.execute(
        """
        UPDATE sessions
        SET completed_at = ?,
            elapsed_seconds = ?,
            running_since = ?
        WHERE id = ? AND deleted_at IS NULL
        """,
        (completed_at, elapsed_seconds, running_since, session_id),
    )
    return get_session(db, session_id)


def set_notes(db: sqlite3.Connection, session_id: int, notes: str) -> dict:
    db.execute(
        """
        UPDATE sessions
        SET notes = ?
        WHERE id = ? AND deleted_at IS NULL
        """,
        (notes, session_id),
    )
    return get_session(db, session_id)


def delete_session(db: sqlite3.Connection, session_id: int, deleted_at: str) -> None:
    db.execute(
        """
        UPDATE sessions
        SET deleted_at = ?
        WHERE id = ? AND deleted_at IS NULL
        """,
        (deleted_at, session_id),
    )
