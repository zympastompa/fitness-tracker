import type { Locator, Page, Response } from "@playwright/test";
import { SetRow } from "./SetRow";

export class ExerciseCard {
  readonly card: Locator;
  readonly exerciseNoteInput: Locator;
  readonly fillEmptyButton: Locator;
  readonly addSetButton: Locator;

  constructor(card: Locator, private readonly page: Page) {
    this.card = card;
    this.exerciseNoteInput = card.getByTestId("exercise-note-input");
    this.fillEmptyButton = card.getByTestId("exercise-fill-empty-button");
    this.addSetButton = card.getByTestId("exercise-add-set-button");
  }

  static byExerciseId(page: Page, exerciseId: string): ExerciseCard {
    return new ExerciseCard(
      page.locator(`[data-testid="exercise-card"][data-exercise-id="${exerciseId}"]`),
      page
    );
  }

  setRow(setIndex: number): SetRow {
    return new SetRow(this.card.locator(`[data-testid="set-row"][data-set-index="${setIndex}"]`));
  }

  async addSet(): Promise<void> {
    await this.addSetButton.click();
  }

  async setExerciseNote(note: string): Promise<Response> {
    const responsePromise = this.page.waitForResponse((response) => {
      return response.url().endsWith("/api/exercise-note") && response.request().method() === "POST";
    });
    await this.exerciseNoteInput.fill(note);
    await this.exerciseNoteInput.dispatchEvent("change");
    return responsePromise;
  }
}
