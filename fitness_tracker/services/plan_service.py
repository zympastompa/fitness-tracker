from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

from fitness_tracker.services.errors import ValidationError


class PlanService:
    def __init__(self, plan_path: Path):
        self.plan_path = plan_path
        self._plan = None

    def get_plan(self) -> dict:
        if self._plan is None:
            with self.plan_path.open("r", encoding="utf-8") as file:
                self._plan = json.load(file)
        return self._plan

    def workout_keys(self) -> List[str]:
        return list(self.get_plan()["workouts"].keys())

    def get_workout(self, workout_key: str) -> dict:
        workouts = self.get_plan()["workouts"]
        if workout_key not in workouts:
            raise ValidationError(f"Unknown workout_key: {workout_key}")
        return workouts[workout_key]

    def exercise_ids(self, workout_key: str) -> List[str]:
        workout = self.get_workout(workout_key)
        return [exercise["id"] for exercise in workout["exercises"]]

    def get_exercise(self, workout_key: str, exercise_id: str) -> Dict:
        for exercise in self.get_workout(workout_key)["exercises"]:
            if exercise["id"] == exercise_id:
                return exercise
        raise ValidationError(f"Unknown exercise_id for workout {workout_key}: {exercise_id}")
