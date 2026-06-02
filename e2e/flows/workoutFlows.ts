import type { ApiClient } from "../api/apiClient";
import type {
  CreateSessionInput,
  SaveSetInput,
  SaveSetResponse,
  WorkoutKey,
  WorkoutSession
} from "../api/types";
import { makeSessionInput, makeSetInput } from "../data/builders";
import type { CleanupContext } from "../fixtures/test";
import type { FitnessTrackerApp } from "../pages/FitnessTrackerApp";
import { ExerciseCard } from "../pages/components/ExerciseCard";
import { SetRow, type SetValues } from "../pages/components/SetRow";

type StartWorkoutOptions = {
  ui: FitnessTrackerApp;
  cleanup: CleanupContext;
  date?: string;
  workout?: WorkoutKey;
};

type SaveFirstSetOptions = {
  ui: FitnessTrackerApp;
  exerciseId: string;
  values: SetValues;
};

type SaveSetContext = {
  exerciseCard: ExerciseCard;
  setRow: SetRow;
  savedSet: SaveSetResponse;
};

type PreviousSessionOptions = {
  api: ApiClient;
  cleanup: CleanupContext;
  session?: Partial<CreateSessionInput>;
  set?: Partial<SaveSetInput>;
};

type BoundStartWorkoutOptions = Omit<StartWorkoutOptions, "ui" | "cleanup">;
type BoundSaveFirstSetOptions = Omit<SaveFirstSetOptions, "ui">;
type BoundPreviousSessionOptions = Omit<PreviousSessionOptions, "api" | "cleanup">;

type WorkoutFlowDependencies = {
  api: ApiClient;
  cleanup: CleanupContext;
  ui: FitnessTrackerApp;
};

export class WorkoutFlows {
  constructor(private readonly dependencies: WorkoutFlowDependencies) {}

  async startWorkoutFromUi(options: BoundStartWorkoutOptions = {}): Promise<WorkoutSession> {
    return startWorkoutFromUi({
      ...options,
      cleanup: this.dependencies.cleanup,
      ui: this.dependencies.ui
    });
  }

  async saveFirstSet(options: BoundSaveFirstSetOptions): Promise<SaveSetContext> {
    return saveFirstSet({
      ...options,
      ui: this.dependencies.ui
    });
  }

  async createPreviousSessionWithCompletedSet(
    options: BoundPreviousSessionOptions = {}
  ): Promise<WorkoutSession> {
    return createPreviousSessionWithCompletedSet({
      ...options,
      api: this.dependencies.api,
      cleanup: this.dependencies.cleanup
    });
  }

  async finishCurrentSession(): Promise<WorkoutSession> {
    return finishCurrentSession(this.dependencies.ui);
  }
}

export async function startWorkoutFromUi(options: StartWorkoutOptions): Promise<WorkoutSession> {
  if (options.date) {
    await options.ui.session.setDate(options.date);
  }
  if (options.workout) {
    await options.ui.workouts.select(options.workout);
  }
  const session = await options.ui.session.startWorkout();
  options.cleanup.trackSession(session);
  return session;
}

export async function saveFirstSet(options: SaveFirstSetOptions): Promise<SaveSetContext> {
  const exerciseCard = options.ui.exercise(options.exerciseId);
  const setRow = exerciseCard.setRow(1);
  const responsePromise = options.ui.page.waitForResponse((response) => {
    return response.url().endsWith("/api/set") && response.request().method() === "POST";
  });
  await setRow.fill(options.values);
  await setRow.save();
  const response = await responsePromise;
  const savedSet = await response.json() as SaveSetResponse;
  return {
    exerciseCard,
    setRow,
    savedSet
  };
}

export async function createPreviousSessionWithCompletedSet(
  options: PreviousSessionOptions
): Promise<WorkoutSession> {
  const session = await options.api.createSession(makeSessionInput(options.session));
  options.cleanup.trackSession(session);
  await options.api.saveSet(makeSetInput(session.id, {
    completed: true,
    ...options.set
  }));
  return session;
}

export async function finishCurrentSession(ui: FitnessTrackerApp): Promise<WorkoutSession> {
  const responsePromise = ui.page.waitForResponse((response) => {
    return response.url().endsWith("/api/complete-session") && response.request().method() === "POST";
  });
  await ui.session.completeSession();
  const response = await responsePromise;
  const payload = await response.json() as { session: WorkoutSession };
  return payload.session;
}
