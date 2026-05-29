from __future__ import annotations

from typing import Any, Dict, Optional
from urllib.parse import parse_qs

from fitness_tracker.config import AppConfig
from fitness_tracker.services.backup_service import BackupService
from fitness_tracker.services.health_service import HealthService
from fitness_tracker.services.history_service import HistoryService
from fitness_tracker.services.plan_service import PlanService
from fitness_tracker.services.session_service import SessionService


class ApiRouter:
    def __init__(self, config: AppConfig):
        self.config = config
        self.plan_service = PlanService(config.plan_path)
        self.session_service = SessionService(config, self.plan_service)
        self.history_service = HistoryService(config)
        self.backup_service = BackupService(config)
        self.health_service = HealthService(config)

    def get(self, path: str, query: Dict[str, list]) -> Optional[Any]:
        if path == "/api/health":
            return self.health_service.check()
        if path == "/api/plan":
            return self.plan_service.get_plan()
        if path == "/api/sessions":
            return self.session_service.list_sessions(_query_one(query, "date"), _query_one(query, "workout"))
        if path == "/api/session":
            session_id = _query_one(query, "id")
            if session_id:
                return self.session_service.get_session_payload(session_id)
            date = _query_one(query, "date")
            workout = _query_one(query, "workout")
            sessions = self.session_service.list_sessions(date, workout)["items"]
            if not sessions:
                return {"session": None, "sets": {}, "exercise_notes": {}}
            return self.session_service.get_session_payload(sessions[-1]["id"])
        if path == "/api/session-suggestions":
            return self.session_service.get_session_suggestions(_query_one(query, "session_id"))
        if path == "/api/history":
            return self.history_service.list_history(_query_one(query, "limit") or 80)
        return None

    def post(self, path: str, payload: Dict[str, Any]) -> Optional[Any]:
        if path == "/api/sessions":
            return self.session_service.create_session(payload)
        if path == "/api/set":
            return self.session_service.save_set(payload)
        if path == "/api/delete-set":
            return self.session_service.delete_set(payload)
        if path == "/api/delete-session":
            return self.session_service.delete_session(payload)
        if path == "/api/session-note":
            return self.session_service.save_session_note(payload)
        if path == "/api/exercise-note":
            return self.session_service.save_exercise_note(payload)
        if path == "/api/complete-session":
            return self.session_service.complete_session(payload)
        if path == "/api/backup":
            return self.backup_service.create_backup()
        return None


def parse_query(raw_query: str) -> Dict[str, list]:
    return parse_qs(raw_query, keep_blank_values=True)


def _query_one(query: Dict[str, list], name: str) -> str:
    values = query.get(name)
    return values[0] if values else ""
