export type WorkoutKey = "A" | "B" | "C";

export type QueryValue = string | number | boolean | null | undefined;

export type CreateSessionInput = {
  date: string;
  workout_key: WorkoutKey;
};

export type WorkoutSession = {
  id: number;
  date: string;
  workout_key: WorkoutKey;
  session_no: number;
  display_no: number;
  completed_at: string | null;
  elapsed_seconds: number;
  running_since: string | null;
  notes: string;
};

export type SessionsResponse = {
  items: WorkoutSession[];
};

export type SaveSetInput = {
  session_id: number;
  exercise_id: string;
  set_index: number;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  completed: boolean;
};

export type WorkoutSet = {
  id: number;
  session_id: number;
  exercise_id: string;
  set_index: number;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  completed: number | boolean;
};

export type SaveSetResponse = {
  set: WorkoutSet;
};
