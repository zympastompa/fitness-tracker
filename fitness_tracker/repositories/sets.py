from __future__ import annotations

import sqlite3
from typing import List, Optional

from fitness_tracker.db.connection import row_to_dict
from fitness_tracker.utils.time import utc_now


def list_sets(db: sqlite3.Connection, session_id: int) -> List[dict]:
    rows = db.execute(
        """
        SELECT *
        FROM sets
        WHERE session_id = ?
        ORDER BY exercise_id, set_index
        """,
        (session_id,),
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def list_completed_sets(db: sqlite3.Connection, session_id: int) -> List[dict]:
    rows = db.execute(
        """
        SELECT *
        FROM sets
        WHERE session_id = ? AND completed = 1
        ORDER BY exercise_id, set_index
        """,
        (session_id,),
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def get_set(db: sqlite3.Connection, session_id: int, exercise_id: str, set_index: int) -> Optional[dict]:
    row = db.execute(
        """
        SELECT *
        FROM sets
        WHERE session_id = ? AND exercise_id = ? AND set_index = ?
        """,
        (session_id, exercise_id, set_index),
    ).fetchone()
    return row_to_dict(row) if row else None


def upsert_set(
    db: sqlite3.Connection,
    session_id: int,
    exercise_id: str,
    set_index: int,
    weight: Optional[float],
    reps: Optional[int],
    rir: Optional[int],
    completed: bool,
) -> dict:
    existing = get_set(db, session_id, exercise_id, set_index)
    completed_at = None
    if completed:
        completed_at = existing["completed_at"] if existing and existing["completed_at"] else utc_now()

    db.execute(
        """
        INSERT INTO sets(session_id, exercise_id, set_index, weight, reps, rir, completed, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id, exercise_id, set_index)
        DO UPDATE SET
            weight = excluded.weight,
            reps = excluded.reps,
            rir = excluded.rir,
            completed = excluded.completed,
            completed_at = excluded.completed_at
        """,
        (session_id, exercise_id, set_index, weight, reps, rir, int(completed), completed_at),
    )
    return get_set(db, session_id, exercise_id, set_index)


def delete_set(db: sqlite3.Connection, session_id: int, exercise_id: str, set_index: int) -> None:
    db.execute(
        """
        DELETE FROM sets
        WHERE session_id = ? AND exercise_id = ? AND set_index = ?
        """,
        (session_id, exercise_id, set_index),
    )
