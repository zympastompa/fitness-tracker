from __future__ import annotations

from datetime import datetime, timezone


def utc_now() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def backup_timestamp() -> str:
    return datetime.utcnow().strftime("%Y%m%d_%H%M%S")


def parse_utc(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        clean = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(clean)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def seconds_between(start: str | None, end: str | None) -> int | None:
    start_dt = parse_utc(start)
    end_dt = parse_utc(end)
    if not start_dt or not end_dt:
        return None
    return max(0, int((end_dt - start_dt).total_seconds()))


def duration_seconds(elapsed_seconds: int | None, running_since: str | None, now: str | None) -> int:
    elapsed = int(elapsed_seconds or 0)
    if not running_since:
        return elapsed
    running = seconds_between(running_since, now)
    return elapsed + (running if running is not None else 0)
