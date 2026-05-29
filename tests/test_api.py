from __future__ import annotations

import json
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from fitness_tracker.api.handler import make_server
from fitness_tracker.db.migrations import migrate
from tests.helpers import TempApp, json_bytes


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.app = TempApp()
        migrate(self.app.config)
        self.server = make_server(self.app.config)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        host, port = self.server.server_address
        self.base_url = f"http://{host}:{port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.app.cleanup()

    def test_health(self):
        status, data, content_type = self.request("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(data, {"ok": True, "db": "ok"})
        self.assertIn("application/json", content_type)

    def test_create_session_save_set_complete_and_history(self):
        status, session, _ = self.request(
            "POST",
            "/api/sessions",
            {"date": "2026-05-19", "workout_key": "A"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(session["session_no"], 1)
        self.assertEqual(session["display_no"], 1)
        self.assertIn("elapsed_seconds", session)
        self.assertIn("running_since", session)

        status, saved, _ = self.request(
            "POST",
            "/api/set",
            {
                "session_id": session["id"],
                "exercise_id": "a_bench_press",
                "set_index": 1,
                "weight": 22.5,
                "reps": 10,
                "rir": 3,
                "completed": True,
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(saved["set"]["reps"], 10)

        status, completed, _ = self.request(
            "POST",
            "/api/complete-session",
            {"session_id": session["id"], "completed": True},
        )
        self.assertEqual(status, 200)
        self.assertIsNotNone(completed["session"]["completed_at"])
        self.assertIn("duration_seconds_live", completed["session"])

        status, history, _ = self.request("GET", "/api/history?limit=10")
        self.assertEqual(status, 200)
        self.assertEqual(history["items"][0]["session_id"], session["id"])
        self.assertEqual(history["items"][0]["summary"]["volume"], 225.0)
        self.assertEqual(history["items"][0]["display_no"], 1)
        self.assertIn("duration_seconds_live", history["items"][0])

    def test_invalid_payload_returns_json_400(self):
        status, data, content_type = self.request(
            "POST",
            "/api/sessions",
            {"date": "bad", "workout_key": "A"},
        )
        self.assertEqual(status, 400)
        self.assertIn("application/json", content_type)
        self.assertIn("error", data)

    def test_delete_session_api(self):
        status, session, _ = self.request(
            "POST",
            "/api/sessions",
            {"date": "2026-05-19", "workout_key": "A"},
        )
        self.assertEqual(status, 200)

        status, deleted, _ = self.request(
            "POST",
            "/api/delete-session",
            {"session_id": session["id"]},
        )
        self.assertEqual(status, 200)
        self.assertEqual(deleted["deleted_session_id"], session["id"])

        status, data, content_type = self.request("GET", f"/api/session?id={session['id']}")
        self.assertEqual(status, 404)
        self.assertIn("application/json", content_type)
        self.assertIn("error", data)

        status, data, _ = self.request(
            "POST",
            "/api/delete-session",
            {"session_id": 0},
        )
        self.assertEqual(status, 400)
        self.assertIn("error", data)

        status, data, _ = self.request(
            "POST",
            "/api/delete-session",
            {"session_id": 99999},
        )
        self.assertEqual(status, 404)
        self.assertIn("error", data)

    def test_sessions_and_session_payload_include_display_no(self):
        _, first, _ = self.request("POST", "/api/sessions", {"date": "2026-05-19", "workout_key": "A"})
        _, second, _ = self.request("POST", "/api/sessions", {"date": "2026-05-19", "workout_key": "A"})
        _, third, _ = self.request("POST", "/api/sessions", {"date": "2026-05-19", "workout_key": "A"})
        self.request("POST", "/api/delete-session", {"session_id": second["id"]})

        status, sessions, _ = self.request("GET", "/api/sessions?date=2026-05-19&workout=A")
        self.assertEqual(status, 200)
        self.assertEqual([item["session_no"] for item in sessions["items"]], [1, 3])
        self.assertEqual([item["display_no"] for item in sessions["items"]], [1, 2])

        status, payload, _ = self.request("GET", f"/api/session?id={third['id']}")
        self.assertEqual(status, 200)
        self.assertEqual(payload["session"]["display_no"], 2)
        self.assertIn("duration_seconds_live", payload["session"])

    def test_session_suggestions_api(self):
        _, previous, _ = self.request("POST", "/api/sessions", {"date": "2026-05-18", "workout_key": "A"})
        self.request(
            "POST",
            "/api/set",
            {
                "session_id": previous["id"],
                "exercise_id": "a_bench_press",
                "set_index": 1,
                "weight": 20,
                "reps": 8,
                "rir": 2,
                "completed": True,
            },
        )
        _, current, _ = self.request("POST", "/api/sessions", {"date": "2026-05-19", "workout_key": "A"})

        status, suggestions, _ = self.request("GET", f"/api/session-suggestions?session_id={current['id']}")
        self.assertEqual(status, 200)
        self.assertEqual(suggestions["session_id"], current["id"])
        self.assertEqual(suggestions["source_session"]["id"], previous["id"])
        self.assertEqual(suggestions["items"]["a_bench_press"]["1"]["weight"], 20)
        self.assertEqual(suggestions["items"]["a_bench_press"]["1"]["reps"], 8)

    def request(self, method, path, payload=None):
        data = json_bytes(payload) if payload is not None else None
        request = Request(
            self.base_url + path,
            data=data,
            method=method,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urlopen(request, timeout=5) as response:
                body = response.read().decode("utf-8")
                parsed = json.loads(body) if body else {}
                return response.status, parsed, response.headers.get("Content-Type", "")
        except HTTPError as error:
            body = error.read().decode("utf-8")
            parsed = json.loads(body) if body else {}
            return error.code, parsed, error.headers.get("Content-Type", "")


if __name__ == "__main__":
    unittest.main()
