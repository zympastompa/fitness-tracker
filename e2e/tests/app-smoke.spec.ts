import { expect, test } from "../fixtures/test";

test("main page loads", async ({ page, ui }) => {
  await ui.goto();

  await expect(page).toHaveTitle("Fitness Tracker");
  await expect(ui.session.activeArea).toContainText("Тренировка A");
  await expect(ui.workouts.workout("A")).toBeVisible();
  await expect(ui.session.dateInput).toBeVisible();
  await expect(ui.session.startButton).toBeVisible();
  await expect(ui.settings.openButton).toBeVisible();
});
