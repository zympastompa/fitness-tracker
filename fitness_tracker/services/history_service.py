from __future__ import annotations

from typing import Any, Dict, List

from fitness_tracker.config import AppConfig
from fitness_tracker.db.connection import connect
from fitness_tracker.repositories import history as history_repo
from fitness_tracker.repositories import sessions as sessions_repo
from fitness_tracker.services.errors import ValidationError
from fitness_tracker.utils.time import duration_seconds, utc_now


class HistoryService:
    def __init__(self, config: AppConfig):
        self.config = config

    def list_history(self, limit: Any = 80) -> Dict[str, List[dict]]:
        clean_limit = self._limit(limit)
        with connect(self.config.db_path) as db:
            rows = history_repo.list_history_rows(db, clean_limit)

        session_ids = [int(row["session_id"]) for row in rows]
        sets_by_session = self._sets_by_session(session_ids)
        display_numbers = self._display_numbers(rows)
        now = utc_now()
        items = []
        for row in rows:
            item = dict(row)
            item["display_no"] = display_numbers.get(int(item["session_id"]), item["session_no"])
            item["duration_seconds_live"] = duration_seconds(
                item.get("elapsed_seconds"),
                item.get("running_since") if not item.get("completed_at") else None,
                now,
            )
            item["summary"] = {
                "sets": int(item.pop("completed_sets")),
                "volume": round(float(item.pop("volume")), 1),
                "reps": int(item.pop("reps")),
                "exercises": int(item.pop("exercises")),
            }
            item["sets"] = sets_by_session.get(item["session_id"], [])
            items.append(item)
        return {"items": items}

    def _limit(self, value: Any) -> int:
        try:
            limit = int(value)
        except (TypeError, ValueError):
            raise ValidationError("limit must be an integer")
        if limit <= 0 or limit > 500:
            raise ValidationError("limit must be between 1 and 500")
        return limit

    def _sets_by_session(self, session_ids: List[int]) -> Dict[int, List[dict]]:
        if not session_ids:
            return {}
        with connect(self.config.db_path) as db:
            rows = history_repo.list_sets_for_sessions(db, session_ids)
        result: Dict[int, List[dict]] = {}
        for row in rows:
            data = dict(row)
            result.setdefault(data["session_id"], []).append(data)
        return result

    def _display_numbers(self, rows) -> Dict[int, int]:
        pairs = {(row["date"], row["workout_key"]) for row in rows}
        result: Dict[int, int] = {}
        with connect(self.config.db_path) as db:
            for date, workout_key in pairs:
                for session in sessions_repo.list_sessions(db, date, workout_key):
                    result[int(session["id"])] = int(session["display_no"])
        return result
