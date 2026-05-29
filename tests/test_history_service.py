from __future__ import annotations

import unittest
from unittest.mock import patch

from fitness_tracker.db.connection import connect
from fitness_tracker.db.migrations import migrate
from fitness_tracker.services.history_service import HistoryService
from fitness_tracker.services.plan_service import PlanService
from fitness_tracker.services.session_service import SessionService
from tests.helpers import TempApp


class HistoryServiceTests(unittest.TestCase):
    def setUp(self):
        self.app = TempApp()
        migrate(self.app.config)
        self.session_service = SessionService(self.app.config, PlanService(self.app.config.plan_path))
        self.history_service = HistoryService(self.app.config)

    def tearDown(self):
        self.app.cleanup()

    def test_history_summary_and_sorting(self):
        first = self.session_service.create_session({"date": "2026-05-19", "workout_key": "A"})
        second = self.session_service.create_session({"date": "2026-05-20", "workout_key": "A"})
        third = self.session_service.create_session({"date": "2026-05-20", "workout_key": "B"})

        self.session_service.save_set(
            {
                "session_id": first["id"],
                "exercise_id": "a_bench_press",
                "set_index": 1,
                "weight": 20,
                "reps": 10,
                "rir": 3,
                "completed": True,
            }
        )
        self.session_service.save_set(
            {
                "session_id": first["id"],
                "exercise_id": "a_bench_press",
                "set_index": 2,
                "weight": 30,
                "reps": 10,
                "rir": 3,
                "completed": False,
            }
        )
        self.session_service.save_set(
            {
                "session_id": second["id"],
                "exercise_id": "a_bench_press",
                "set_index": 1,
                "weight": 25,
                "reps": 8,
                "rir": 2,
                "completed": True,
            }
        )

        with connect(self.app.config.db_path) as db:
            db.execute("UPDATE sessions SET started_at = '2026-05-19T10:00:00Z' WHERE id = ?", (first["id"],))
            db.execute("UPDATE sessions SET started_at = '2026-05-20T10:00:00Z' WHERE id = ?", (second["id"],))
            db.execute("UPDATE sessions SET started_at = '2026-05-20T11:00:00Z' WHERE id = ?", (third["id"],))

        history = self.history_service.list_history()["items"]
        self.assertEqual(history[0]["session_id"], third["id"])
        self.assertEqual(history[1]["session_id"], second["id"])
        self.assertEqual(history[2]["session_id"], first["id"])

        first_item = next(item for item in history if item["session_id"] == first["id"])
        self.assertEqual(first_item["summary"]["sets"], 1)
        self.assertEqual(first_item["summary"]["volume"], 200.0)
        self.assertEqual(first_item["summary"]["reps"], 10)
        self.assertIn("elapsed_seconds", first_item)
        self.assertIn("running_since", first_item)
        self.assertIn("duration_seconds_live", first_item)
        self.assertIn("session_id", first_item)
        self.assertIn("display_no", first_item)

        self.session_service.delete_session({"session_id": second["id"]})
        history = self.history_service.list_history()["items"]
        self.assertNotIn(second["id"], {item["session_id"] for item in history})

    def test_history_display_numbers_have_no_gaps_after_delete(self):
        first = self.session_service.create_session({"date": "2026-05-21", "workout_key": "A"})
        middle = self.session_service.create_session({"date": "2026-05-21", "workout_key": "A"})
        last = self.session_service.create_session({"date": "2026-05-21", "workout_key": "A"})
        self.session_service.delete_session({"session_id": middle["id"]})

        with connect(self.app.config.db_path) as db:
            db.execute("UPDATE sessions SET started_at = '2026-05-21T10:00:00Z' WHERE id = ?", (first["id"],))
            db.execute("UPDATE sessions SET started_at = '2026-05-21T12:00:00Z' WHERE id = ?", (last["id"],))

        history = self.history_service.list_history()["items"]
        visible = [item for item in history if item["workout_key"] == "A" and item["date"] == "2026-05-21"]
        self.assertEqual([item["session_id"] for item in visible], [last["id"], first["id"]])
        self.assertEqual([item["display_no"] for item in visible], [2, 1])
        self.assertNotIn(middle["id"], {item["session_id"] for item in history})

    def test_history_includes_frozen_completed_duration(self):
        with patch("fitness_tracker.services.session_service.utc_now", return_value="2026-05-21T10:00:00Z"):
            session = self.session_service.create_session({"date": "2026-05-21", "workout_key": "A"})
        with patch("fitness_tracker.services.session_service.utc_now", return_value="2026-05-21T11:12:00Z"):
            self.session_service.complete_session({"session_id": session["id"], "completed": True})

        history = self.history_service.list_history()["items"]
        item = next(item for item in history if item["session_id"] == session["id"])
        self.assertEqual(item["elapsed_seconds"], 4320)
        self.assertEqual(item["duration_seconds_live"], 4320)


if __name__ == "__main__":
    unittest.main()
