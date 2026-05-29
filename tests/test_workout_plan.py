from __future__ import annotations

import json
import unittest
from pathlib import Path

from fitness_tracker.services.plan_service import PlanService


ROOT = Path(__file__).resolve().parents[1]


class WorkoutPlanTests(unittest.TestCase):
    def setUp(self):
        self.plan_path = ROOT / "workout_plan.json"
        self.plan = json.loads(self.plan_path.read_text(encoding="utf-8"))

    def test_exercises_are_single_trackable_items(self):
        ids = []
        for workout_key, workout in self.plan["workouts"].items():
            for exercise in workout["exercises"]:
                with self.subTest(workout=workout_key, exercise=exercise["id"]):
                    ids.append(exercise["id"])
                    name = exercise["name"]
                    self.assertNotIn(" или ", name)
                    self.assertNotIn(" / ", name)
                    self.assertNotIn("+", name)
                    self.assertIsInstance(exercise["target_sets"], int)
                    self.assertGreater(exercise["target_sets"], 0)
                    self.assertIsInstance(exercise["rest_seconds"], int)
                    self.assertGreater(exercise["rest_seconds"], 0)
                    self.assertTrue(exercise["target"].strip())
                    self.assertTrue(exercise["comment"].strip())
        self.assertEqual(len(ids), len(set(ids)))

    def test_plan_service_validates_updated_exercises(self):
        service = PlanService(self.plan_path)
        for workout_key, workout in self.plan["workouts"].items():
            self.assertEqual(service.get_workout(workout_key)["title"], workout["title"])
            for exercise in workout["exercises"]:
                self.assertEqual(service.get_exercise(workout_key, exercise["id"])["name"], exercise["name"])


if __name__ == "__main__":
    unittest.main()
