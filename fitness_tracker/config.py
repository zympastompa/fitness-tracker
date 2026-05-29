from __future__ import annotations

import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Optional


PROJECT_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class AppConfig:
    root_dir: Path
    static_dir: Path
    plan_path: Path
    data_dir: Path
    backups_dir: Path
    db_path: Path
    host: str
    port: int
    legacy_db_path: Optional[Path] = None


def get_config(env: Optional[Mapping[str, str]] = None) -> AppConfig:
    values = env or os.environ
    root_dir = Path(values.get("FITNESS_TRACKER_ROOT", PROJECT_ROOT)).resolve()
    data_dir = root_dir / "data"
    db_env = values.get("FITNESS_TRACKER_DB_PATH")
    db_path = Path(db_env).expanduser().resolve() if db_env else data_dir / "fitness_tracker.sqlite3"
    return AppConfig(
        root_dir=root_dir,
        static_dir=root_dir / "static",
        plan_path=root_dir / "workout_plan.json",
        data_dir=db_path.parent if db_env else data_dir,
        backups_dir=(db_path.parent if db_env else data_dir) / "backups",
        db_path=db_path,
        host=values.get("FITNESS_TRACKER_HOST", "127.0.0.1"),
        port=int(values.get("FITNESS_TRACKER_PORT", "8000")),
        legacy_db_path=root_dir / "fitness_tracker.sqlite3",
    )


def prepare_database_file(config: AppConfig) -> None:
    config.data_dir.mkdir(parents=True, exist_ok=True)
    config.backups_dir.mkdir(parents=True, exist_ok=True)
    if config.db_path.exists():
        return
    legacy = config.legacy_db_path
    if legacy and legacy.exists() and legacy.resolve() != config.db_path.resolve():
        shutil.copy2(legacy, config.db_path)
