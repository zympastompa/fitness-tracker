import type { CreateSessionInput, SaveSetInput, WorkoutKey } from "../api/types";

const defaultSessionInput: CreateSessionInput = {
  date: "2026-01-01",
  workout_key: "A"
};

export function makeSessionInput(overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
  return {
    ...defaultSessionInput,
    ...overrides
  };
}

export function makeSetInput(
  sessionId: number,
  overrides: Partial<SaveSetInput> = {}
): SaveSetInput {
  return {
    session_id: sessionId,
    exercise_id: "a_bench_press",
    set_index: 1,
    weight: 25,
    reps: 8,
    rir: 2,
    completed: false,
    ...overrides
  };
}

export function makeWorkoutKey(key: WorkoutKey = "A"): WorkoutKey {
  return key;
}
