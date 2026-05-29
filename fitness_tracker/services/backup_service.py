from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Dict

from fitness_tracker.config import AppConfig
from fitness_tracker.db.connection import connect
from fitness_tracker.utils.time import backup_timestamp


class BackupService:
    def __init__(self, config: AppConfig):
        self.config = config

    def create_backup(self, prefix: str = "fitness_tracker") -> Dict[str, str]:
        self.config.backups_dir.mkdir(parents=True, exist_ok=True)
        destination = self.config.backups_dir / f"{prefix}_{backup_timestamp()}.sqlite3"
        self._backup_to(destination)
        return {
            "ok": True,
            "path": str(destination),
            "filename": destination.name,
        }

    def create_export_snapshot(self) -> Path:
        result = self.create_backup("fitness_tracker_export")
        return Path(result["path"])

    def _backup_to(self, destination: Path) -> None:
        source = connect(self.config.db_path)
        target = sqlite3.connect(destination)
        try:
            source.backup(target)
        finally:
            target.close()
            source.close()
