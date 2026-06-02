import type { Locator, Page } from "@playwright/test";
import type { WorkoutSession } from "../api/types";
import { ExerciseCard } from "./components/ExerciseCard";
import { HistoryPanel } from "./components/HistoryPanel";
import { RestTimer } from "./components/RestTimer";
import { SessionPanel } from "./components/SessionPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { WorkoutTabs } from "./components/WorkoutTabs";

type SessionTracker = (session: WorkoutSession) => void;

export class FitnessTrackerApp {
  readonly history: HistoryPanel;
  readonly restTimer: RestTimer;
  readonly session: SessionPanel;
  readonly settings: SettingsPanel;
  readonly workouts: WorkoutTabs;
  readonly toasts: Locator;

  constructor(readonly page: Page, trackSession: SessionTracker = () => undefined) {
    this.history = new HistoryPanel(page);
    this.restTimer = new RestTimer(page);
    this.session = new SessionPanel(page, trackSession);
    this.settings = new SettingsPanel(page);
    this.workouts = new WorkoutTabs(page);
    this.toasts = page.getByTestId("toast");
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
  }

  exercise(exerciseId: string): ExerciseCard {
    return ExerciseCard.byExerciseId(this.page, exerciseId);
  }

  toast(message: string): Locator {
    return this.toasts.filter({ hasText: message });
  }

  async scrollToVerticalPosition(y: number): Promise<void> {
    await this.page.evaluate((top) => window.scrollTo(0, top), y);
  }
}
