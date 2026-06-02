# Fitness Tracker

Local-first fitness tracker for a home A/B/C workout program. Built with a Python standard-library HTTP server, SQLite, and vanilla HTML/CSS/JavaScript without a build step.

## Why This Project

This is a backend-lite / frontend-lite / QA-friendly pet project that solves a practical personal workflow: tracking home workouts locally, without accounts, cloud storage, or external services.

The project is intentionally simple at runtime, but still structured like a maintainable application:

* layered backend structure
* SQLite migrations
* repository and service layers
* backend/API tests with Python `unittest`
* UI/E2E tests with Playwright TypeScript
* page/component objects for browser automation
* fixture-driven setup and cleanup
* isolated SQLite database for E2E runs
* CI quality gates
* vanilla frontend modules
* Docker support
* local backups and database export

## Local-First

Workout progress is stored on the current device in a SQLite database file. The app does not require an account, external backend, cloud database, or third-party runtime service.

Backup and export features are available from the settings screen, but the main workout flow stays focused on starting a session, recording sets, using rest timers, and reviewing history.

## No Runtime Dependencies

The app has no Python runtime dependencies.

Required for the app:

* Python 3.10+
* a browser

Required for UI/E2E tests:

* Node.js 18+
* Playwright browsers

The Python app and `unittest` suite use only the Python standard library. Browser E2E tests use Node.js and Playwright as development dependencies only.

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

Run backend/API tests:

```bash
python -m unittest discover -s tests
```

Or:

```bash
make test
```

### E2E / UI Automation

The UI automation layer uses Playwright with TypeScript. It is a development/test dependency only and is separate from the Python application runtime.

Install Node dependencies and Playwright browsers:

```bash
npm ci
npx playwright install chromium
```

Run TypeScript checks:

```bash
npm run e2e:typecheck
```

Run the E2E suite:

```bash
npm run e2e
```

Run with a visible browser:

```bash
npm run e2e:headed
```

Open the Playwright report:

```bash
npm run e2e:report
```

When Playwright starts the app itself, it recreates `e2e/.tmp/` and runs the Python server with:

```text
FITNESS_TRACKER_DB_PATH=e2e/.tmp/fitness_tracker_e2e.sqlite3
```

This keeps E2E SQLite data separate from local development data.

The Playwright suite currently runs with one worker. The app uses one isolated SQLite file per E2E run, and single-worker execution keeps session setup, cleanup, and previous-session test data predictable until parallel database isolation is introduced.

Current E2E coverage includes:

* start session
* save set
* repeat set
* fill empty sets
* fill workout
* rest timer controls
* session notes and exercise notes
* history navigation
* settings backup and database export
* responsive smoke checks

## E2E Architecture

The browser automation layer is organized to keep test scenarios readable and UI details isolated.

```text
e2e/
  api/              typed API client for setup and cleanup
  assertions/       reusable UI/layout assertions
  data/             deterministic test data builders
  fixtures/         Playwright fixtures
  flows/            domain-level workout flows
  pages/            page and component objects
  tests/            Playwright TypeScript E2E specs
```

Main ideas:

* specs describe user scenarios;
* page/component objects hide UI selectors and repeated browser actions;
* domain flows compose several UI/API operations for common workout scenarios;
* API client is used for setup and cleanup, not as a replacement for real UI checks;
* E2E data is isolated through a separate SQLite database;
* created sessions are tracked and deleted after each test through the existing `/api/delete-session` endpoint;
* TypeScript is checked separately with `tsc`;
* CI uploads Playwright artifacts only when E2E tests fail.

The fixture layer exposes:

* tracked API client;
* top-level UI page object;
* domain flows;
* cleanup context.

This keeps tests focused on behavior while still making setup, cleanup and diagnostics explicit.

## Quality Gates

Recommended checks before publishing or changing the project:

```bash
python -m compileall fitness_tracker tests main.py
python -m unittest discover -s tests
npm run e2e:typecheck
npm run e2e
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

CI runs Python compile checks, Python `unittest`, Docker Compose validation, and a separate Playwright E2E job after the Python job passes.

The E2E job:

* installs Node dependencies with `npm ci`;
* installs the Playwright Chromium browser;
* runs TypeScript checks with `npm run e2e:typecheck`;
* runs Playwright tests with `npm run e2e`.

On E2E failure, CI uploads:

* `playwright-report/`
* `test-results/`

Playwright traces, screenshots, videos, and error context are retained through those test result artifacts when a test fails.

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

tests/
  backend/db/API tests with Python unittest

e2e/
  api/              typed API client for setup and cleanup
  assertions/       reusable UI/layout assertions
  data/             deterministic test data builders
  fixtures/         Playwright fixtures
  flows/            domain-level workout flows
  pages/            page and component objects
  tests/            Playwright TypeScript E2E tests
```

## Roadmap

* Exercise progress charts.
* CSV export.
* PWA/offline install.
* Optional auth for home-server usage.
* Parallel E2E execution with per-worker database isolation.

## Positioning

This project is intentionally small and local-first. It is not trying to be a commercial fitness platform.

The goal is to show a maintainable, testable, practical application with a simple runtime model and a real personal workflow behind it.

From the QA/SDET side, the project demonstrates:

* backend/API checks with Python `unittest`;
* UI/E2E automation with Playwright TypeScript;
* isolated test data;
* setup and cleanup strategy;
* page/component object architecture;
* CI quality gates;
* a real user flow instead of synthetic demo scenarios.