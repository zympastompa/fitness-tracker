import type { Locator } from "@playwright/test";

export type SetValues = {
  weight: string;
  reps: string;
  rir: string;
};

export class SetRow {
  readonly row: Locator;
  readonly weightInput: Locator;
  readonly repsInput: Locator;
  readonly rirInput: Locator;
  readonly completedBadge: Locator;
  readonly saveButton: Locator;
  readonly repeatButton: Locator;
  readonly deleteButton: Locator;
  readonly uncompleteButton: Locator;

  constructor(row: Locator) {
    this.row = row;
    this.weightInput = row.getByTestId("set-weight-input");
    this.repsInput = row.getByTestId("set-reps-input");
    this.rirInput = row.getByTestId("set-rir-input");
    this.completedBadge = row.getByTestId("set-completed-badge");
    this.saveButton = row.getByTestId("set-save-button");
    this.repeatButton = row.getByTestId("set-repeat-button");
    this.deleteButton = row.getByTestId("set-delete-button");
    this.uncompleteButton = row.getByTestId("set-uncomplete-button");
  }

  async fill(values: SetValues): Promise<void> {
    await this.weightInput.fill(values.weight);
    await this.repsInput.fill(values.reps);
    await this.rirInput.selectOption(values.rir);
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  async repeat(): Promise<void> {
    await this.repeatButton.click();
  }
}
