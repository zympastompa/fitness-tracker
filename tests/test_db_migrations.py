from __future__ import annotations

import sqlite3
import unittest

from fitness_tracker.db.connection import connect
from fitness_tracker.db.migrations import migrate
from fitness_tracker.services.plan_service import PlanService
from fitness_tracker.services.session_service import SessionService
from tests.helpers import TempApp


class DbMigrationTests(unittest.TestCase):
    def setUp(self):
        self.app = TempApp()

    def tearDown(self):
        self.app.cleanup()

    def test_empty_database_migrates_idempotently(self):
        migrate(self.app.config)
        with connect(self.app.config.db_path) as db:
            tables = {
                row["name"]
                for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            }
            self.assertTrue({"sessions", "sets", "exercise_notes", "schema_migrations"}.issubset(tables))
            columns = {row["name"] for row in db.execute("PRAGMA table_info(sessions)").fetchall()}
            self.assertIn("deleted_at", columns)
            self.assertIn("elapsed_seconds", columns)
            self.assertIn("running_since", columns)
            self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0], "ok")

        migrate(self.app.config)
        with connect(self.app.config.db_path) as db:
            count = db.execute("SELECT COUNT(*) FROM schema_migrations").fetchone()[0]
            self.assertEqual(count, 1)

    def test_old_unique_schema_migrates_without_data_loss(self):
        self._create_old_schema()
        migrate(self.app.config)

        backups = list((self.app.config.backups_dir).glob("pre_migration_*.sqlite3"))
        self.assertEqual(len(backups), 1)

        with connect(self.app.config.db_path) as db:
            session = db.execute("SELECT * FROM sessions WHERE id = 7").fetchone()
            self.assertEqual(session["date"], "2026-05-19")
            self.assertEqual(session["workout_key"], "A")
            self.assertEqual(session["session_no"], 1)
            self.assertIsNone(session["deleted_at"])
            self.assertEqual(session["elapsed_seconds"], 0)
            self.assertIsNotNone(session["running_since"])
            completed_session = db.execute("SELECT * FROM sessions WHERE id = 8").fetchone()
            self.assertEqual(completed_session["elapsed_seconds"], 1800)
            self.assertIsNone(completed_session["running_since"])
            saved_set = db.execute("SELECT * FROM sets WHERE session_id = 7").fetchone()
            self.assertEqual(saved_set["exercise_id"], "a_bench_press")
            note = db.execute("SELECT * FROM exercise_notes WHERE session_id = 7").fetchone()
            self.assertEqual(note["notes"], "old note")
            self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(), [])

        service = SessionService(self.app.config, PlanService(self.app.config.plan_path))
        first = service.create_session({"date": "2026-05-20", "workout_key": "A"})
        second = service.create_session({"date": "2026-05-20", "workout_key": "A"})
        self.assertEqual(first["session_no"], 1)
        self.assertEqual(second["session_no"], 2)

    def _create_old_schema(self):
        self.app.config.db_path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.app.config.db_path)
        try:
            db.executescript(
                """
                CREATE TABLE sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    workout_key TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    completed_at TEXT,
                    notes TEXT NOT NULL DEFAULT '',
                    UNIQUE(date, workout_key)
                );

                CREATE TABLE sets (
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

                CREATE TABLE exercise_notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    exercise_id TEXT NOT NULL,
                    notes TEXT NOT NULL DEFAULT '',
                    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                    UNIQUE(session_id, exercise_id)
                );
                """
            )
            db.execute(
                """
                INSERT INTO sessions(id, date, workout_key, started_at, notes)
                VALUES (7, '2026-05-19', 'A', '2026-05-19T10:00:00Z', 'legacy')
                """
            )
            db.execute(
                """
                INSERT INTO sessions(id, date, workout_key, started_at, completed_at, notes)
                VALUES (8, '2026-05-19', 'B', '2026-05-19T11:00:00Z', '2026-05-19T11:30:00Z', 'completed')
                """
            )
            db.execute(
                """
                INSERT INTO sets(session_id, exercise_id, set_index, weight, reps, rir, completed, completed_at)
                VALUES (7, 'a_bench_press', 1, 22.5, 10, 3, 1, '2026-05-19T10:10:00Z')
                """
            )
            db.execute(
                """
                INSERT INTO exercise_notes(session_id, exercise_id, notes)
                VALUES (7, 'a_bench_press', 'old note')
                """
            )
            db.commit()
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
