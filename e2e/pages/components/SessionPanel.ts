import type { Locator, Page, Response } from "@playwright/test";
import type { WorkoutSession } from "../../api/types";

type SessionTracker = (session: WorkoutSession) => void;

export class SessionPanel {
  readonly activeArea: Locator;
  readonly status: Locator;
  readonly metrics: Locator;
  readonly dateInput: Locator;
  readonly startButton: Locator;
  readonly fillWorkoutButton: Locator;
  readonly completeButton: Locator;
  readonly deleteButton: Locator;
  readonly notesInput: Locator;
  readonly saveNotesButton: Locator;

  constructor(
    private readonly page: Page,
    private readonly trackSession: SessionTracker = () => undefined
  ) {
    this.activeArea = page.getByTestId("active-session-area");
    this.status = page.getByTestId("session-status");
    this.metrics = page.getByTestId("session-metrics");
    this.dateInput = page.getByTestId("session-date-input");
    this.startButton = page.getByTestId("workout-start-button");
    this.fillWorkoutButton = page.getByTestId("workout-fill-button");
    this.completeButton = page.getByTestId("session-complete-button");
    this.deleteButton = page.getByTestId("session-delete-button");
    this.notesInput = page.getByTestId("session-notes-input");
    this.saveNotesButton = page.getByTestId("session-notes-save-button");
  }

  async setDate(date: string): Promise<void> {
    const reloadPromise = this.page.waitForResponse((response) => {
      return response.url().includes("/api/sessions?")
        && response.url().includes(`date=${date}`)
        && response.request().method() === "GET";
    });
    await this.dateInput.fill(date);
    await this.dateInput.dispatchEvent("change");
    await reloadPromise;
  }

  async startWorkout(): Promise<WorkoutSession> {
    const responsePromise = this.page.waitForResponse((response) => {
      return response.url().endsWith("/api/sessions") && response.request().method() === "POST";
    });
    await this.startButton.click();
    const response = await responsePromise;
    const session = await response.json() as WorkoutSession;
    this.trackSession(session);
    return session;
  }

  async fillWorkout(): Promise<void> {
    await this.fillWorkoutButton.click();
  }

  async completeSession(): Promise<void> {
    await this.completeButton.click();
  }

  async deleteSession(): Promise<void> {
    await this.deleteButton.click();
  }

  async saveNote(note: string): Promise<Response> {
    const responsePromise = this.page.waitForResponse((response) => {
      return response.url().endsWith("/api/session-note") && response.request().method() === "POST";
    });
    await this.notesInput.fill(note);
    await this.saveNotesButton.click();
    return responsePromise;
  }
}
