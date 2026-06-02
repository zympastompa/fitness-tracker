import type { Locator, Page } from "@playwright/test";
import type { WorkoutKey } from "../../api/types";

export class WorkoutTabs {
  readonly tabs: Locator;

  constructor(private readonly page: Page) {
    this.tabs = page.getByTestId("workout-tabs");
  }

  workout(key: WorkoutKey): Locator {
    return this.page.locator(`[data-testid="workout-tab"][data-workout-key="${key}"]`);
  }

  async select(key: WorkoutKey): Promise<void> {
    await this.workout(key).click();
  }
}
