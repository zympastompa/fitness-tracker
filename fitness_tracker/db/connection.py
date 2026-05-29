from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Union


DbPath = Union[str, Path]


def connect(db_path: DbPath) -> sqlite3.Connection:
    path = str(db_path)
    connection = sqlite3.connect(path, timeout=5)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 5000")
    if path != ":memory:":
        connection.execute("PRAGMA journal_mode = WAL")
    return connection


def row_to_dict(row: sqlite3.Row) -> dict:
    return {key: row[key] for key in row.keys()}
