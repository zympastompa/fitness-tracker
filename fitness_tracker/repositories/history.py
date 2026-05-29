from __future__ import annotations

import sqlite3
from typing import List

from fitness_tracker.db.connection import row_to_dict


def list_history_rows(db: sqlite3.Connection, limit: int) -> List[dict]:
    rows = db.execute(
        """
        SELECT
            sessions.id AS session_id,
            sessions.date,
            sessions.workout_key,
            sessions.session_no,
            sessions.started_at,
            sessions.completed_at,
            sessions.elapsed_seconds,
            sessions.running_since,
            sessions.notes,
            COUNT(CASE WHEN sets.completed = 1 THEN 1 END) AS completed_sets,
            COALESCE(SUM(CASE WHEN sets.completed = 1 THEN COALESCE(sets.weight, 0) * COALESCE(sets.reps, 0) ELSE 0 END), 0) AS volume,
            COALESCE(SUM(CASE WHEN sets.completed = 1 THEN COALESCE(sets.reps, 0) ELSE 0 END), 0) AS reps,
            COUNT(DISTINCT CASE WHEN sets.completed = 1 THEN sets.exercise_id END) AS exercises
        FROM sessions
        LEFT JOIN sets ON sets.session_id = sessions.id
        WHERE sessions.deleted_at IS NULL
        GROUP BY sessions.id
        ORDER BY sessions.date DESC, sessions.started_at DESC, sessions.id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def list_sets_for_sessions(db: sqlite3.Connection, session_ids: List[int]) -> List[dict]:
    if not session_ids:
        return []
    placeholders = ",".join("?" for _ in session_ids)
    rows = db.execute(
        f"""
        SELECT *
        FROM sets
        WHERE session_id IN ({placeholders})
        ORDER BY session_id, exercise_id, set_index
        """,
        session_ids,
    ).fetchall()
    return [row_to_dict(row) for row in rows]
