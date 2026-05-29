PYTHON ?= python3

.PHONY: run test backup

run:
	$(PYTHON) main.py

test:
	$(PYTHON) -m unittest discover -s tests

backup:
	$(PYTHON) -c "from fitness_tracker.config import get_config; from fitness_tracker.db.migrations import migrate; from fitness_tracker.services.backup_service import BackupService; c=get_config(); migrate(c); print(BackupService(c).create_backup()['path'])"
