from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Any, Dict, Tuple

from fitness_tracker.config import AppConfig, PROJECT_ROOT


class TempApp:
    def __init__(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tempdir.name)
        self.config = AppConfig(
            root_dir=PROJECT_ROOT,
            static_dir=PROJECT_ROOT / "static",
            plan_path=PROJECT_ROOT / "workout_plan.json",
            data_dir=self.root,
            backups_dir=self.root / "backups",
            db_path=self.root / "fitness_tracker.sqlite3",
            host="127.0.0.1",
            port=0,
            legacy_db_path=None,
        )

    def cleanup(self):
        self.tempdir.cleanup()


def json_bytes(payload: Dict[str, Any]) -> bytes:
    return json.dumps(payload).encode("utf-8")
