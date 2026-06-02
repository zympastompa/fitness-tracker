import { expect, test } from "../fixtures/test";

const benchPressId = "a_bench_press";
const pausedBenchId = "c_paused_bench";

test("start workout session", async ({ flows, ui }) => {
  await ui.goto();

  const session = await flows.startWorkoutFromUi({
    workout: "C"
  });

  expect(session.workout_key).toBe("C");
  await expect(ui.session.activeArea).toContainText("Тренировка C");
  await expect(ui.session.activeArea).toContainText("В работе");
  await expect(ui.session.status).toHaveText("В работе");
  await expect(ui.exercise(pausedBenchId).card).toBeVisible();
});

test("save a set completes it and starts rest timer", async ({ flows, ui }) => {
  await ui.goto();
  await flows.startWorkoutFromUi({
    date: "2026-03-01",
    workout: "A"
  });

  const firstSet = await flows.saveFirstSet({
    exerciseId: benchPressId,
    values: {
      weight: "24",
      reps: "10",
      rir: "2"
    }
  });

  await expect(firstSet.setRow.completedBadge).toBeVisible();
  await expect(ui.session.metrics).toContainText(/1\/\d+/);
  await expect(ui.restTimer.timer).toHaveClass(/is-running/);
  await expect(ui.restTimer.timer).toContainText("Отдых");
});

test("repeat set copies values without completing the next set", async ({ flows, ui }) => {
  await ui.goto();
  await flows.startWorkoutFromUi({
    date: "2026-03-02",
    workout: "A"
  });

  const firstSet = await flows.saveFirstSet({
    exerciseId: benchPressId,
    values: {
      weight: "26.5",
      reps: "9",
      rir: "3"
    }
  });
  await expect(firstSet.setRow.completedBadge).toBeVisible();

  const secondSet = firstSet.exerciseCard.setRow(2);
  await secondSet.repeat();

  await expect(secondSet.weightInput).toHaveValue("26.5");
  await expect(secondSet.repsInput).toHaveValue("9");
  await expect(secondSet.rirInput).toHaveValue("3");
  await expect(secondSet.completedBadge).toHaveCount(0);
  await expect(secondSet.saveButton).toBeEnabled();
});

test("fill workout fills empty fields without overwriting manual values", async ({ flows, page, ui }) => {
  await flows.createPreviousSessionWithCompletedSet({
    session: {
      date: "2026-03-03",
      workout_key: "A"
    },
    set: {
      exercise_id: benchPressId,
      set_index: 1,
      weight: 31,
      reps: 11,
      rir: 1
    }
  });

  await ui.goto();
  await flows.startWorkoutFromUi({
    date: "2026-03-04",
    workout: "A"
  });

  const firstExercise = ui.exercise(benchPressId);
  const firstSet = firstExercise.setRow(1);

  await expect(firstExercise.fillEmptyButton).toBeVisible();
  await firstSet.repsInput.fill("7");
  page.once("dialog", (dialog) => dialog.accept());
  await ui.session.fillWorkout();

  await expect(firstSet.weightInput).toHaveValue("31");
  await expect(firstSet.repsInput).toHaveValue("7");
  await expect(firstSet.rirInput).toHaveValue("1");
  await expect(firstSet.completedBadge).toHaveCount(0);
});

test("finish workout and open it from history", async ({ flows, ui }) => {
  await ui.goto();
  const session = await flows.startWorkoutFromUi({
    date: "2026-03-05",
    workout: "A"
  });

  const firstSet = await flows.saveFirstSet({
    exerciseId: benchPressId,
    values: {
      weight: "22",
      reps: "8",
      rir: "2"
    }
  });
  await expect(firstSet.setRow.completedBadge).toBeVisible();

  await flows.finishCurrentSession();
  await expect(ui.session.activeArea).toContainText("Завершена");

  const historyItem = ui.history.itemBySessionId(session.id);
  await expect(historyItem).toContainText("завершена");
  await expect(historyItem).toContainText("Тренировка A");

  await ui.workouts.select("B");
  await expect(ui.session.activeArea).toContainText("Тренировка B");

  await ui.history.openSession(session.id);
  await expect(ui.session.activeArea).toContainText("Тренировка A");
  await expect(ui.session.activeArea).toContainText("Завершена");
});
