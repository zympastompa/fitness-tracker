FROM python:3.12-slim

WORKDIR /app

COPY . /app

ENV FITNESS_TRACKER_HOST=0.0.0.0
ENV FITNESS_TRACKER_PORT=8000
ENV FITNESS_TRACKER_DB_PATH=/app/data/fitness_tracker.sqlite3

EXPOSE 8000

CMD ["python3", "main.py"]
