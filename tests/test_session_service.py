from __future__ import annotations

import unittest
from unittest.mock import patch

from fitness_tracker.db.migrations import migrate
from fitness_tracker.services.errors import NotFoundError, ValidationError
from fitness_tracker.services.plan_service import PlanService
from fitness_tracker.services.session_service import SessionService
from tests.helpers import TempApp


class SessionServiceTests(unittest.TestCase):
    def setUp(self):
        self.app = TempApp()
        migrate(self.app.config)
        self.service = SessionService(self.app.config, PlanService(self.app.config.plan_path))

    def tearDown(self):
        self.app.cleanup()

    def test_create_multiple_sessions_and_manage_sets_notes_completion(self):
        first = self.service.create_session({"date": "2026-05-19", "workout_key": "A"})
        second = self.service.create_session({"date": "2026-05-19", "workout_key": "A"})
        self.assertEqual(first["session_no"], 1)
        self.assertEqual(second["session_no"], 2)
        self.assertEqual(first["display_no"], 1)
        self.assertEqual(second["display_no"], 2)

        saved = self.service.save_set(
            {
                "session_id": first["id"],
                "exercise_id": "a_bench_press",
                "set_index": 1,
                "weight": 22.5,
                "reps": 10,
                "rir": 3,
                "completed": True,
            }
        )["set"]
        self.assertEqual(saved["weight"], 22.5)
        self.assertEqual(saved["reps"], 10)
        self.assertEqual(saved["completed"], 1)

        updated = self.service.save_set(
            {
                "session_id": first["id"],
                "exercise_id": "a_bench_press",
                "set_index": 1,
                "weight": 25,
                "reps": 8,
                "rir": 2,
                "completed": True,
            }
        )["set"]
        self.assertEqual(updated["weight"], 25)
        self.assertEqual(updated["reps"], 8)

        self.service.delete_set(
            {
                "session_id": first["id"],
                "exercise_id": "a_bench_press",
                "set_index": 1,
            }
        )
        payload = self.service.get_session_payload(first["id"])
        self.assertEqual(payload["sets"], {})

        completed = self.service.complete_session({"session_id": first["id"], "completed": True})["session"]
        self.assertIsNotNone(completed["completed_at"])
        self.assertIsNone(completed["running_since"])
        reopened = self.service.complete_session({"session_id": first["id"], "completed": False})["session"]
        self.assertIsNone(reopened["completed_at"])
        self.assertIsNotNone(reopened["running_since"])

        noted = self.service.save_session_note({"session_id": first["id"], "notes": "felt good"})["session"]
        self.assertEqual(noted["notes"], "felt good")
        self.service.save_exercise_note(
            {
                "session_id": first["id"],
                "exercise_id": "a_bench_press",
                "notes": "keep wrists stacked",
            }
        )
        payload = self.service.get_session_payload(first["id"])
        self.assertEqual(payload["exercise_notes"]["a_bench_press"], "keep wrists stacked")

    def test_validation_errors(self):
        with self.assertRaises(ValidationError):
            self.service.create_session({"date": "19-05-2026", "workout_key": "A"})
        with self.assertRaises(ValidationError):
            self.service.create_session({"date": "2026-05-19", "workout_key": "Z"})

        session = self.service.create_session({"date": "2026-05-19", "workout_key": "A"})

        invalid_payloads = [
            {
                "session_id": session["id"],
                "exercise_id": "unknown",
                "set_index": 1,
                "weight": 10,
                "reps": 8,
                "rir": 2,
                "completed": True,
            },
            {
                "session_id": session["id"],
                "exercise_id": "a_bench_press",
                "set_index": 0,
                "weight": 10,
                "reps": 8,
                "rir": 2,
                "completed": True,
            },
            {
                "session_id": session["id"],
                "exercise_id": "a_bench_press",
                "set_index": 1,
                "weight": -1,
                "reps": 8,
                "rir": 2,
                "completed": True,
            },
            {
                "session_id": session["id"],
                "exercise_id": "a_bench_press",
                "set_index": 1,
                "weight": 10,
                "reps": -1,
                "rir": 2,
                "completed": True,
            },
            {
                "session_id": session["id"],
                "exercise_id": "a_bench_press",
                "set_index": 1,
                "weight": 10,
                "reps": 8,
                "rir": 6,
                "completed": True,
            },
            {
                "session_id": session["id"],
                "exercise_id": "a_bench_press",
                "set_index": 1,
                "weight": 10,
                "reps": 8,
                "rir": 2,
                "completed": "yes",
            },
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(ValidationError):
                    self.service.save_set(payload)

    def test_delete_session_hides_empty_and_populated_sessions(self):
        empty = self.service.create_session({"date": "2026-05-19", "workout_key": "A"})
        result = self.service.delete_session({"session_id": empty["id"]})
        self.assertEqual(result, {"ok": True, "deleted_session_id": empty["id"]})
        self.assertEqual(self.service.list_sessions("2026-05-19", "A")["items"], [])
        with self.assertRaises(NotFoundError):
            self.service.get_session_payload(empty["id"])

        populated = self.service.create_session({"date": "2026-05-19", "workout_key": "A"})
        self.service.save_set(
            {
                "session_id": populated["id"],
                "exercise_id": "a_bench_press",
                "set_index": 1,
                "weight": 20,
                "reps": 8,
                "rir": 3,
                "completed": True,
            }
        )
        self.service.save_session_note({"session_id": populated["id"], "notes": "delete me"})
        self.service.save_exercise_note(
            {
                "session_id": populated["id"],
                "exercise_id": "a_bench_press",
                "notes": "old",
            }
        )
        self.service.delete_session({"session_id": populated["id"]})
        self.assertEqual(self.service.list_sessions("2026-05-19", "A")["items"], [])
        with self.assertRaises(NotFoundError):
            self.service.get_session_payload(populated["id"])

        with self.assertRaises(ValidationError):
            self.service.delete_session({"session_id": 0})
        with self.assertRaises(NotFoundError):
            self.service.delete_session({"session_id": 9999})

    def test_display_numbers_ignore_deleted_sessions(self):
        first = self.service.create_session({"date": "2026-05-19", "workout_key": "A"})
        second = self.service.create_session({"date": "2026-05-19", "workout_key": "A"})
        self.service.delete_session({"session_id": first["id"]})

        visible = self.service.list_sessions("2026-05-19", "A")["items"]
        self.assertEqual([item["session_no"] for item in visible], [2])
        self.assertEqual([item["display_no"] for item in visible], [1])

        third = self.service.create_session({"date": "2026-05-19", "workout_key": "A"})
        visible = self.service.list_sessions("2026-05-19", "A")["items"]
        self.assertEqual([item["session_no"] for item in visible], [2, 3])
        self.assertEqual([item["display_no"] for item in visible], [1, 2])

        payload = self.service.get_session_payload(third["id"])
        self.assertEqual(payload["session"]["display_no"], 2)

    def test_session_duration_create_complete_reopen_and_accumulate(self):
        with patch("fitness_tracker.services.session_service.utc_now", return_value="2026-05-19T10:00:00Z"):
            session = self.service.create_session({"date": "2026-05-19", "workout_key": "A"})
        self.assertEqual(session["elapsed_seconds"], 0)
        self.assertEqual(session["running_since"], "2026-05-19T10:00:00Z")

        with patch("fitness_tracker.services.session_service.utc_now", return_value="2026-05-19T10:10:00Z"):
            completed = self.service.complete_session({"session_id": session["id"], "completed": True})["session"]
        self.assertEqual(completed["elapsed_seconds"], 600)
        self.assertEqual(completed["duration_seconds_live"], 600)
        self.assertIsNone(completed["running_since"])

        with patch("fitness_tracker.services.session_service.utc_now", return_value="2026-05-19T10:20:00Z"):
            reopened = self.service.complete_session({"session_id": session["id"], "completed": False})["session"]
        self.assertEqual(reopened["elapsed_seconds"], 600)
        self.assertEqual(reopened["running_since"], "2026-05-19T10:20:00Z")

        with patch("fitness_tracker.services.session_service.utc_now", return_value="2026-05-19T10:25:00Z"):
            completed_again = self.service.complete_session({"session_id": session["id"], "completed": True})["session"]
        self.assertEqual(completed_again["elapsed_seconds"], 900)
        self.assertEqual(completed_again["duration_seconds_live"], 900)

    def test_suggestions_use_previous_non_deleted_completed_same_workout_session(self):
        previous = self.service.create_session({"date": "2026-05-18", "workout_key": "A"})
        self._save_set(previous["id"], "a_bench_press", 1, 20, 8, 2, True)
        self._save_set(previous["id"], "a_bench_press", 2, 22.5, 6, 1, False)
        deleted = self.service.create_session({"date": "2026-05-19", "workout_key": "A"})
        self._save_set(deleted["id"], "a_bench_press", 1, 99, 1, 0, True)
        self.service.delete_session({"session_id": deleted["id"]})
        current = self.service.create_session({"date": "2026-05-20", "workout_key": "A"})

        suggestions = self.service.get_session_suggestions(current["id"])
        self.assertEqual(suggestions["source_session"]["id"], previous["id"])
        self.assertEqual(suggestions["items"]["a_bench_press"]["1"]["weight"], 20)
        self.assertEqual(suggestions["items"]["a_bench_press"]["1"]["reps"], 8)
        self.assertEqual(suggestions["items"]["a_bench_press"]["1"]["rir"], 2)
        self.assertNotIn("2", suggestions["items"]["a_bench_press"])

    def test_suggestions_use_same_workout_only(self):
        previous = self.service.create_session({"date": "2026-05-18", "workout_key": "B"})
        self._save_set(previous["id"], "b_incline_press", 1, 24, 9, 2, True)
        current = self.service.create_session({"date": "2026-05-19", "workout_key": "A"})

        suggestions = self.service.get_session_suggestions(current["id"])
        self.assertIsNone(suggestions["source_session"])
        self.assertEqual(suggestions["items"], {})

    def test_suggestions_prefer_same_exercise_and_same_set_index(self):
        previous = self.service.create_session({"date": "2026-05-18", "workout_key": "A"})
        self._save_set(previous["id"], "a_bench_press", 1, 20, 8, 2, True)
        self._save_set(previous["id"], "a_bench_press", 2, 25, 5, 1, True)
        current = self.service.create_session({"date": "2026-05-19", "workout_key": "A"})

        suggestions = self.service.get_session_suggestions(current["id"])
        self.assertEqual(suggestions["items"]["a_bench_press"]["2"]["weight"], 25)
        self.assertEqual(suggestions["items"]["a_bench_press"]["2"]["reps"], 5)

    def _save_set(self, session_id, exercise_id, set_index, weight, reps, rir, completed):
        return self.service.save_set(
            {
                "session_id": session_id,
                "exercise_id": exercise_id,
                "set_index": set_index,
                "weight": weight,
                "reps": reps,
                "rir": rir,
                "completed": completed,
            }
        )


if __name__ == "__main__":
    unittest.main()
