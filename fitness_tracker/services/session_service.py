from __future__ import annotations

import re
from datetime import date
from typing import Any, Dict, Optional

from fitness_tracker.config import AppConfig
from fitness_tracker.db.connection import connect
from fitness_tracker.repositories import notes as notes_repo
from fitness_tracker.repositories import sessions as sessions_repo
from fitness_tracker.repositories import sets as sets_repo
from fitness_tracker.services.errors import NotFoundError, ValidationError
from fitness_tracker.services.plan_service import PlanService
from fitness_tracker.utils.time import duration_seconds, utc_now


DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class SessionService:
    def __init__(self, config: AppConfig, plan_service: PlanService):
        self.config = config
        self.plan_service = plan_service

    def create_session(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        date = self._require_date(payload.get("date"))
        workout_key = self._require_workout_key(payload.get("workout_key"))
        now = utc_now()
        with connect(self.config.db_path) as db:
            session = sessions_repo.create_session(db, date, workout_key, now)
        return self._with_duration(session, now)

    def list_sessions(self, date: str, workout_key: str) -> Dict[str, Any]:
        clean_date = self._require_date(date)
        clean_workout = self._require_workout_key(workout_key)
        now = utc_now()
        with connect(self.config.db_path) as db:
            sessions = sessions_repo.list_sessions(db, clean_date, clean_workout)
        sessions = [self._with_duration(session, now) for session in sessions]
        return {"items": sessions}

    def get_session_payload(self, session_id: Any) -> Dict[str, Any]:
        clean_session_id = self._require_positive_int(session_id, "session_id")
        with connect(self.config.db_path) as db:
            session = self._get_session_or_raise(db, clean_session_id)
            set_rows = sets_repo.list_sets(db, clean_session_id)
            exercise_notes = notes_repo.list_exercise_notes(db, clean_session_id)
        sets_by_exercise: Dict[str, Dict[str, dict]] = {}
        for row in set_rows:
            sets_by_exercise.setdefault(row["exercise_id"], {})[str(row["set_index"])] = row
        return {
            "session": self._with_duration(session),
            "sets": sets_by_exercise,
            "exercise_notes": exercise_notes,
        }

    def get_session_suggestions(self, session_id: Any) -> Dict[str, Any]:
        clean_session_id = self._require_positive_int(session_id, "session_id")
        with connect(self.config.db_path) as db:
            session = self._get_session_or_raise(db, clean_session_id)
            source_session = sessions_repo.find_previous_session(db, session)
            if not source_session:
                return {
                    "session_id": clean_session_id,
                    "source_session": None,
                    "items": {},
                }
            previous_sets = sets_repo.list_completed_sets(db, int(source_session["id"]))

        items: Dict[str, Dict[str, dict]] = {}
        for set_row in previous_sets:
            exercise_items = items.setdefault(set_row["exercise_id"], {})
            exercise_items[str(set_row["set_index"])] = {
                "weight": set_row["weight"],
                "reps": set_row["reps"],
                "rir": set_row["rir"],
                "source": "previous_session",
            }

        return {
            "session_id": clean_session_id,
            "source_session": {
                "id": source_session["id"],
                "date": source_session["date"],
                "workout_key": source_session["workout_key"],
                "display_no": source_session.get("display_no", source_session["session_no"]),
            },
            "items": items,
        }

    def save_set(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        session_id = self._require_positive_int(payload.get("session_id"), "session_id")
        set_index = self._require_positive_int(payload.get("set_index"), "set_index")
        completed = self._require_bool(payload.get("completed"), "completed")
        weight = self._optional_non_negative_float(payload.get("weight"), "weight")
        reps = self._optional_non_negative_int(payload.get("reps"), "reps")
        rir = self._optional_rir(payload.get("rir"))
        exercise_id = self._require_string(payload.get("exercise_id"), "exercise_id")
        with connect(self.config.db_path) as db:
            session = self._get_session_or_raise(db, session_id)
            self.plan_service.get_exercise(session["workout_key"], exercise_id)
            saved = sets_repo.upsert_set(db, session_id, exercise_id, set_index, weight, reps, rir, completed)
        return {"set": saved}

    def delete_set(self, payload: Dict[str, Any]) -> Dict[str, bool]:
        session_id = self._require_positive_int(payload.get("session_id"), "session_id")
        set_index = self._require_positive_int(payload.get("set_index"), "set_index")
        exercise_id = self._require_string(payload.get("exercise_id"), "exercise_id")
        with connect(self.config.db_path) as db:
            session = self._get_session_or_raise(db, session_id)
            self.plan_service.get_exercise(session["workout_key"], exercise_id)
            sets_repo.delete_set(db, session_id, exercise_id, set_index)
        return {"ok": True}

    def complete_session(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        session_id = self._require_positive_int(payload.get("session_id"), "session_id")
        completed = self._require_bool(payload.get("completed", True), "completed")
        now = utc_now()
        with connect(self.config.db_path) as db:
            current = self._get_session_or_raise(db, session_id)
            next_state = self._completion_state(current, completed, now)
            session = sessions_repo.set_completion_state(db, session_id, **next_state)
        return {"session": self._with_duration(session, now)}

    def save_session_note(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        session_id = self._require_positive_int(payload.get("session_id"), "session_id")
        text = self._require_text(payload.get("notes"), "notes")
        with connect(self.config.db_path) as db:
            self._get_session_or_raise(db, session_id)
            session = sessions_repo.set_notes(db, session_id, text)
        return {"session": self._with_duration(session)}

    def save_exercise_note(self, payload: Dict[str, Any]) -> Dict[str, bool]:
        session_id = self._require_positive_int(payload.get("session_id"), "session_id")
        exercise_id = self._require_string(payload.get("exercise_id"), "exercise_id")
        text = self._require_text(payload.get("notes"), "notes")
        with connect(self.config.db_path) as db:
            session = self._get_session_or_raise(db, session_id)
            self.plan_service.get_exercise(session["workout_key"], exercise_id)
            notes_repo.upsert_exercise_note(db, session_id, exercise_id, text)
        return {"ok": True}

    def delete_session(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        session_id = self._require_positive_int(payload.get("session_id"), "session_id")
        with connect(self.config.db_path) as db:
            self._get_session_or_raise(db, session_id)
            sessions_repo.delete_session(db, session_id, utc_now())
        return {"ok": True, "deleted_session_id": session_id}

    def _get_session_or_raise(self, db, session_id: int) -> dict:
        session = sessions_repo.get_session(db, session_id)
        if not session:
            raise NotFoundError(f"Session not found: {session_id}")
        self.plan_service.get_workout(session["workout_key"])
        return session

    def _completion_state(self, session: dict, completed: bool, now: str) -> dict:
        if completed:
            elapsed = duration_seconds(session.get("elapsed_seconds"), session.get("running_since"), now)
            return {
                "completed_at": session.get("completed_at") or now,
                "elapsed_seconds": elapsed,
                "running_since": None,
            }
        if not session.get("completed_at") and session.get("running_since"):
            running_since = session.get("running_since")
        else:
            running_since = now
        return {
            "completed_at": None,
            "elapsed_seconds": int(session.get("elapsed_seconds") or 0),
            "running_since": running_since,
        }

    def _with_duration(self, session: dict, now: str | None = None) -> dict:
        result = dict(session)
        current_now = now or utc_now()
        running_since = None if result.get("completed_at") else result.get("running_since")
        result["duration_seconds_live"] = duration_seconds(result.get("elapsed_seconds"), running_since, current_now)
        return result

    def _require_date(self, value: Any) -> str:
        if not isinstance(value, str) or not DATE_RE.match(value):
            raise ValidationError("date must be ISO YYYY-MM-DD")
        try:
            date.fromisoformat(value)
        except ValueError:
            raise ValidationError("date must be ISO YYYY-MM-DD")
        return value

    def _require_workout_key(self, value: Any) -> str:
        if not isinstance(value, str):
            raise ValidationError("workout_key is required")
        self.plan_service.get_workout(value)
        return value

    def _require_string(self, value: Any, field: str) -> str:
        if not isinstance(value, str) or not value:
            raise ValidationError(f"{field} must be a non-empty string")
        return value

    def _require_text(self, value: Any, field: str) -> str:
        if value is None:
            return ""
        if not isinstance(value, str):
            raise ValidationError(f"{field} must be a string")
        return value

    def _require_bool(self, value: Any, field: str) -> bool:
        if not isinstance(value, bool):
            raise ValidationError(f"{field} must be boolean")
        return value

    def _require_positive_int(self, value: Any, field: str) -> int:
        number = self._strict_int(value, field, positive=True)
        if number <= 0:
            raise ValidationError(f"{field} must be a positive integer")
        return number

    def _optional_non_negative_float(self, value: Any, field: str) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, bool):
            raise ValidationError(f"{field} must be a non-negative number or null")
        try:
            number = float(value)
        except (TypeError, ValueError):
            raise ValidationError(f"{field} must be a non-negative number or null")
        if number < 0:
            raise ValidationError(f"{field} must be a non-negative number or null")
        return number

    def _optional_non_negative_int(self, value: Any, field: str) -> Optional[int]:
        if value is None:
            return None
        number = self._strict_int(value, field)
        if number < 0:
            raise ValidationError(f"{field} must be a non-negative integer or null")
        return number

    def _optional_rir(self, value: Any) -> Optional[int]:
        if value is None:
            return None
        number = self._strict_int(value, "rir")
        if number < 0 or number > 5:
            raise ValidationError("rir must be null or int 0..5")
        return number

    def _strict_int(self, value: Any, field: str, positive: bool = False) -> int:
        message = f"{field} must be a {'positive ' if positive else ''}integer"
        if isinstance(value, bool):
            raise ValidationError(message)
        if isinstance(value, int):
            return value
        if isinstance(value, str) and re.match(r"^\d+$", value):
            return int(value)
        raise ValidationError(message)
