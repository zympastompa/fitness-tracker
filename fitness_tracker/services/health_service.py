from __future__ import annotations

from fitness_tracker.config import AppConfig
from fitness_tracker.db.connection import connect
from fitness_tracker.repositories import health as health_repo


class HealthService:
    def __init__(self, config: AppConfig):
        self.config = config

    def check(self) -> dict:
        with connect(self.config.db_path) as db:
            health_repo.check_database(db)
        return {"ok": True, "db": "ok"}
