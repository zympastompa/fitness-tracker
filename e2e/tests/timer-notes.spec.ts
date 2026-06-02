import { expect, test } from "../fixtures/test";

const benchPressId = "a_bench_press";

test("rest timer controls work and floating timer does not block the next set input", async ({ flows, ui }) => {
  await ui.goto();
  await flows.startWorkoutFromUi({
    date: "2026-04-01",
    workout: "A"
  });

  const firstSet = await flows.saveFirstSet({
    exerciseId: benchPressId,
    values: {
      weight: "25",
      reps: "8",
      rir: "2"
    }
  });

  await expect(firstSet.setRow.completedBadge).toBeVisible();
  await expect(ui.restTimer.root).toHaveClass(/is-running/);
  await expect(ui.restTimer.root).toContainText("Отдых");

  await ui.restTimer.pause();
  await expect(ui.restTimer.pauseButton).toHaveText("Продолжить");
  const pausedSeconds = await ui.restTimer.secondsRemaining();

  await ui.restTimer.add30Seconds();
  const plusSeconds = await ui.restTimer.secondsRemaining();
  expect(plusSeconds).toBeGreaterThanOrEqual(pausedSeconds + 29);

  await ui.restTimer.subtract15Seconds();
  const minusSeconds = await ui.restTimer.secondsRemaining();
  expect(minusSeconds).toBeLessThanOrEqual(plusSeconds - 14);

  await ui.restTimer.resume();
  await expect(ui.restTimer.pauseButton).toHaveText("Пауза");

  await ui.scrollToVerticalPosition(800);
  await expect(ui.restTimer.root).toHaveClass(/is-floating/);

  const nextSet = firstSet.exerciseCard.setRow(2);
  await nextSet.weightInput.click();
  await expect(nextSet.weightInput).toBeFocused();

  await ui.restTimer.skip();
  await expect(ui.restTimer.root).toHaveClass(/is-done/);
  await expect(ui.restTimer.root).toContainText("Можно продолжать");
});

test("session and exercise notes persist after reopening the session", async ({ flows, ui }) => {
  const sessionNote = "session note e2e";
  const exerciseNote = "exercise note e2e";

  await ui.goto();
  const session = await flows.startWorkoutFromUi({
    date: "2026-04-02",
    workout: "A"
  });

  await test.step("save notes", async () => {
    await ui.session.saveNote(sessionNote);
    await expect(ui.toast("Заметки сохранены")).toBeVisible();

    await ui.exercise(benchPressId).setExerciseNote(exerciseNote);
    await expect(ui.toast("Заметка по упражнению сохранена")).toBeVisible();
  });

  await test.step("reopen session from history", async () => {
    await ui.page.reload();
    await ui.history.openSession(session.id);
  });

  await expect(ui.session.notesInput).toHaveValue(sessionNote);
  await expect(ui.exercise(benchPressId).exerciseNoteInput).toHaveValue(exerciseNote);
});
