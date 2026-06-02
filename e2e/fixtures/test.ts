import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ApiClient } from "../api/apiClient";
import type { CreateSessionInput, WorkoutSession } from "../api/types";
import { makeSessionInput } from "../data/builders";
import { WorkoutFlows } from "../flows/workoutFlows";
import { FitnessTrackerApp } from "../pages/FitnessTrackerApp";

export type CleanupContext = {
  readonly createdSessionIds: readonly number[];
  trackSession: (session: number | Pick<WorkoutSession, "id"> | null | undefined) => void;
};

export type FitnessTrackerDriver = {
  api: ApiClient;
  page: Page;
  createSession: (input?: Partial<CreateSessionInput>) => Promise<WorkoutSession>;
  startWorkoutThroughUi: () => Promise<WorkoutSession>;
};

type Fixtures = {
  api: ApiClient;
  cleanup: CleanupContext;
  app: FitnessTrackerDriver;
  ui: FitnessTrackerApp;
  flows: WorkoutFlows;
};

export const test = base.extend<Fixtures>({
  api: async ({ cleanup, request }, use) => {
    await use(new ApiClient(request, cleanup.trackSession));
  },
  cleanup: async ({ request }, use) => {
    const cleanupApi = new ApiClient(request);
    const createdSessionIds = new Set<number>();
    const cleanup: CleanupContext = {
      get createdSessionIds() {
        return [...createdSessionIds].sort((left, right) => left - right);
      },
      trackSession(session) {
        const id = typeof session === "number" ? session : session?.id;
        if (typeof id === "number") {
          createdSessionIds.add(id);
        }
      }
    };
    await use(cleanup);
    const cleanupErrors: Error[] = [];
    for (const sessionId of [...cleanup.createdSessionIds].sort((left, right) => right - left)) {
      try {
        await cleanupApi.deleteSession(sessionId);
      } catch (error) {
        cleanupErrors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, `Failed to clean up ${cleanupErrors.length} E2E session(s)`);
    }
  },
  app: async ({ api, cleanup, page }, use) => {
    const helper: FitnessTrackerDriver = {
      api,
      page,
      async createSession(input = {}) {
        const session = await api.createSession(makeSessionInput(input));
        cleanup.trackSession(session);
        return session;
      },
      async startWorkoutThroughUi() {
        const responsePromise = page.waitForResponse((response) => {
          return response.url().endsWith("/api/sessions") && response.request().method() === "POST";
        });
        await page.getByTestId("workout-start-button").click();
        const response = await responsePromise;
        const session = await response.json() as WorkoutSession;
        cleanup.trackSession(session);
        return session;
      }
    };
    await use(helper);
  },
  ui: async ({ cleanup, page }, use) => {
    await use(new FitnessTrackerApp(page, cleanup.trackSession));
  },
  flows: async ({ api, cleanup, ui }, use) => {
    await use(new WorkoutFlows({
      api,
      cleanup,
      ui
    }));
  }
});

export { expect };
