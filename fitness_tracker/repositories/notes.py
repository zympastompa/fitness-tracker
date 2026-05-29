from __future__ import annotations

import sqlite3
from typing import Dict


def list_exercise_notes(db: sqlite3.Connection, session_id: int) -> Dict[str, str]:
    rows = db.execute(
        """
        SELECT exercise_id, notes
        FROM exercise_notes
        WHERE session_id = ?
        """,
        (session_id,),
    ).fetchall()
    return {row["exercise_id"]: row["notes"] for row in rows}


def upsert_exercise_note(db: sqlite3.Connection, session_id: int, exercise_id: str, notes: str) -> None:
    db.execute(
        """
        INSERT INTO exercise_notes(session_id, exercise_id, notes)
        VALUES (?, ?, ?)
        ON CONFLICT(session_id, exercise_id)
        DO UPDATE SET notes = excluded.notes
        """,
        (session_id, exercise_id, notes),
    )
