from __future__ import annotations

from fitness_tracker.api.handler import make_server
from fitness_tracker.config import get_config
from fitness_tracker.db.migrations import migrate


def main() -> None:
    config = get_config()
    migrate(config)
    server = make_server(config)
    host, port = server.server_address
    shown_host = "127.0.0.1" if host == "0.0.0.0" else host
    print(f"Fitness Tracker is running: http://{shown_host}:{port}", flush=True)
    print("Press Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Fitness Tracker.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
