from __future__ import annotations

import json
import mimetypes
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

from fitness_tracker.api.responses import send_error, send_file, send_json
from fitness_tracker.api.routing import ApiRouter, parse_query
from fitness_tracker.config import AppConfig
from fitness_tracker.services.errors import NotFoundError, ValidationError


def make_handler(config: AppConfig):
    router = ApiRouter(config)

    class FitnessTrackerHandler(BaseHTTPRequestHandler):
        server_version = "FitnessTracker/0.2"

        def log_message(self, format: str, *args: Any) -> None:
            sys.stdout.write("[%s] %s\n" % (self.log_date_time_string(), format % args))

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path == "/api/export-db":
                self._handle_export()
                return
            if parsed.path.startswith("/api/"):
                self._handle_api_get(parsed.path, parsed.query)
                return
            self._serve_static(parsed.path, include_body=True)

        def do_HEAD(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path.startswith("/api/"):
                send_error(self, "Not found", 404)
                return
            self._serve_static(parsed.path, include_body=False)

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            if not parsed.path.startswith("/api/"):
                self.send_error(404)
                return
            self._handle_api_post(parsed.path)

        def _handle_api_get(self, path: str, raw_query: str) -> None:
            try:
                payload = router.get(path, parse_query(raw_query))
                if payload is None:
                    send_error(self, "Not found", 404)
                    return
                send_json(self, payload)
            except ValidationError as error:
                send_error(self, str(error), 400)
            except NotFoundError as error:
                send_error(self, str(error), 404)
            except Exception as error:
                send_error(self, str(error), 500)

        def _handle_api_post(self, path: str) -> None:
            try:
                payload = self._read_json()
                result = router.post(path, payload)
                if result is None:
                    send_error(self, "Not found", 404)
                    return
                send_json(self, result)
            except json.JSONDecodeError:
                send_error(self, "Request body must be valid JSON", 400)
            except ValidationError as error:
                send_error(self, str(error), 400)
            except NotFoundError as error:
                send_error(self, str(error), 404)
            except Exception as error:
                send_error(self, str(error), 500)

        def _handle_export(self) -> None:
            try:
                snapshot = router.backup_service.create_export_snapshot()
                send_file(self, snapshot, "fitness_tracker.sqlite3")
            except Exception as error:
                send_error(self, str(error), 500)

        def _read_json(self) -> dict:
            length = int(self.headers.get("Content-Length", "0"))
            if length == 0:
                return {}
            raw = self.rfile.read(length).decode("utf-8")
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                raise ValidationError("Request body must be a JSON object")
            return parsed

        def _serve_static(self, path: str, include_body: bool) -> None:
            file_path = self._static_file(path)
            if not file_path or not file_path.exists() or not file_path.is_file():
                self.send_error(404)
                return
            body = file_path.read_bytes() if include_body else b""
            content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(file_path.stat().st_size))
            self.end_headers()
            if include_body:
                self.wfile.write(body)

        def _static_file(self, path: str) -> Optional[Path]:
            static_dir = config.static_dir.resolve()
            if path == "/":
                return static_dir / "index.html"
            if not path.startswith("/static/"):
                return None
            relative = path.removeprefix("/static/")
            file_path = (static_dir / relative).resolve()
            if file_path == static_dir or static_dir not in file_path.parents:
                return None
            return file_path

    return FitnessTrackerHandler


def make_server(config: AppConfig) -> ThreadingHTTPServer:
    last_error: Optional[OSError] = None
    for port in range(config.port, config.port + 20):
        try:
            return ThreadingHTTPServer((config.host, port), make_handler(config))
        except OSError as error:
            last_error = error
    raise RuntimeError(f"No free local port found near {config.port}: {last_error}")
