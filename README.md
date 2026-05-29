# Fitness Tracker

Local-first fitness tracker for a home A/B/C workout program. Built with a Python standard-library HTTP server, SQLite, and vanilla HTML/CSS/JavaScript without a build step.

## Why This Project

This is a backend-lite / frontend-lite / QA-friendly pet project that solves a practical personal workflow: tracking home workouts locally, without accounts, cloud storage, or external services.

The project is intentionally simple at runtime, but still structured like a maintainable application:

* layered backend structure
* SQLite migrations
* repository and service layers
* API tests with `unittest`
* vanilla frontend modules
* Docker support
* local backups and database export

## Local-First

Workout progress is stored on the current device in a SQLite database file. The app does not require an account, external backend, cloud database, or third-party runtime service.

Backup and export features are available from the settings screen, but the main workout flow stays focused on starting a session, recording sets, using rest timers, and reviewing history.

## No Runtime Dependencies

The app has no Python runtime dependencies.

Required:

* Python 3.10+
* a browser

Development and test commands use only the Python standard library.

## Features

* Multiple workout sessions of the same type on the same day, for example `A #1` and `A #2`.
* Set tracking with weight, reps, RIR, and completion status.
* Explicit set lifecycle: draft → `Save` → `Completed`.
* Autofill actions based on the previous set and previous session:

  * repeat set
  * fill empty sets
  * fill workout
* Rest timer after a saved set:

  * pause
  * resume
  * `+30 sec`
  * `-15 sec`
  * skip
  * floating mini-timer while scrolling
  * jump to the next set
* Live workout duration timer during active sessions.
* Saved duration in workout history.
* Session history by `session_id`.
* Session notes and exercise notes.
* Local SQLite storage.
* Local database backups through the settings screen.
* Database export endpoint.
* Soft delete for accidentally created workout sessions.

## Quickstart

Run locally:

```bash
python3 main.py
```

Open the URL printed in the terminal, usually:

```text
http://127.0.0.1:8000
```

Or use the Makefile:

```bash
make run
```

## Tests

Run the test suite:

```bash
python -m unittest discover -s tests
```

Or:

```bash
make test
```

## Quality Gates

Recommended checks before publishing or changing the project:

```bash
python -m compileall fitness_tracker tests main.py
python -m unittest discover -s tests
docker compose config
```

Manual smoke check:

```bash
python3 main.py
```

Then open:

```text
http://127.0.0.1:8000
```

The test suite uses `unittest`, temporary directories, and temporary SQLite files. Browser/e2e tests are intentionally not included at this stage.

## Data Storage

By default, workout progress is stored in:

```text
data/fitness_tracker.sqlite3
```

SQLite is not a separate database service like Postgres or MySQL. It is a local database file opened directly by the application. That is why the app does not need a separate database container or a running database server.

Progress remains available after restarting the app as long as this file is preserved:

```text
data/fitness_tracker.sqlite3
```

SQLite can also create nearby WAL files:

```text
fitness_tracker.sqlite3-wal
fitness_tracker.sqlite3-shm
```

This is expected behavior when WAL mode is enabled.

If an old database file exists in the project root:

```text
fitness_tracker.sqlite3
```

and the new file does not exist yet:

```text
data/fitness_tracker.sqlite3
```

the app copies the old database into `data/` on startup and applies migrations. Before rebuilding an old schema, it creates a backup under:

```text
data/backups/
```

## Custom Database Path

Use `FITNESS_TRACKER_DB_PATH` to run the app with a custom SQLite file:

```bash
FITNESS_TRACKER_DB_PATH=/absolute/path/fitness_tracker.sqlite3 python3 main.py
```

## Backups and Export

From the UI, open `Settings` in the left menu and click `Create backup`.

Via API:

```bash
curl -X POST http://127.0.0.1:8000/api/backup
```

Backup files are created under:

```text
data/backups/fitness_tracker_YYYYMMDD_HHMMSS.sqlite3
```

Download the current database file:

```text
http://127.0.0.1:8000/api/export-db
```

Makefile shortcut:

```bash
make backup
```

## UX Notes

The main workout screen intentionally does not show technical database or backup details. The main flow is:

1. choose workout type
2. start a session
3. record sets
4. use the rest timer
5. finish the workout
6. review history when needed

Backup and database export actions live in settings so they do not distract during training.

## Manual QA Checklist

* Create a new A/B/C workout session.
* Enter kg/reps/RIR and verify that simple input does not start the rest timer.
* Click `Save` and verify completed state, summary update, and timer start.
* Click `Repeat` on the next unfinished set and verify that weight/reps/RIR are copied, but the set is not marked completed.
* Create the next session of the same workout and verify `Fill empty` / `Fill workout`.
* Verify that manually entered fields are not overwritten by autofill.
* Scroll down after starting a rest timer and verify that the mini-timer is visible.
* Verify that the mini-timer does not cover input rows.
* Use the jump-to-set action and verify that it focuses the next set.
* Check live duration in the hero section.
* Complete a workout and verify that duration appears in history.
* Reopen a completed workout and verify that duration continues correctly if the session is returned to work.
* Edit a completed set and verify that the timer does not restart unexpectedly.
* Click `Undo` and verify that the set returns to draft state.
* Add and delete a set.
* Create two sessions of the same workout type on one day and delete one of them.
* Open history and navigate to a specific session.
* Create a backup through settings.
* Check layout at `1366x768` and `390x844`.
* Verify there is no horizontal scroll.
* Verify the left menu does not have broken ellipsis or clipped labels.

## Docker Compose

Docker runs only the application. There is no separate database service because SQLite is stored as a file.

```bash
docker compose up --build
```

The Compose file mounts local data into the container:

```text
./data:/app/data
```

This keeps the SQLite database available between container restarts.

## Updating the Workout Program

The workout plan is stored in:

```text
workout_plan.json
```

You can edit:

* exercises
* notes
* number of sets
* rest duration

The backend validates `workout_key` and `exercise_id` against this file.

Each `exercise` should represent one trackable movement. Avoid alternatives or combined names such as:

```text
exercise A / exercise B
exercise A or exercise B
exercise A + exercise B
```

If an `exercise_id` is changed, old history remains in the database, but new records will be saved under the new exercise id.

## Project Structure

```text
fitness_tracker/
  api/              HTTP handler, routing, JSON responses
  db/               SQLite connection and migrations
  repositories/     SQL access layer
  services/         business logic and validation
  utils/            small helpers

static/
  index.html
  styles.css
  js/               vanilla ES modules

tests/              unittest backend/db/API tests
```

## Roadmap

* Exercise progress charts.
* CSV export.
* PWA/offline install.
* Optional auth for home-server usage.
* UI/e2e tests as a separate layer.

## Positioning

This project is intentionally small and local-first. It is not trying to be a commercial fitness platform. The goal is to show a maintainable, testable, practical application with a simple runtime model and a real personal workflow behind it.
