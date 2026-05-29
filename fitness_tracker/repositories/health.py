from __future__ import annotations

import sqlite3


def check_database(db: sqlite3.Connection) -> None:
    db.execute("SELECT 1").fetchone()
