import { state } from "./state.js";
import { formatDurationShort, formatRest, formatSessionDuration, formatSessionLabel, intOrNull, numberOrNull, roundVolume } from "./format.js";

export const els = {};

export function cacheElements() {
  Object.assign(els, {
    workoutTabs: document.querySelector("#workoutTabs"),
    safetyRules: document.querySelector("#safetyRules"),
    sessionDate: document.querySelector("#sessionDate"),
    sessionPicker: document.querySelector("#sessionPicker"),
    sessionPickerField: document.querySelector(".session-select"),
    newSession: document.querySelector("#newSession"),
    fillWorkout: document.querySelector("#fillWorkout"),
    historyRefresh: document.querySelector("#historyRefresh"),
    completeSession: document.querySelector("#completeSession"),
    deleteSession: document.querySelector("#deleteSession"),
    settingsOpen: document.querySelector("#settingsOpen"),
    settingsPanel: document.querySelector("#settingsPanel"),
    settingsClose: document.querySelector("#settingsClose"),
    backupDb: document.querySelector("#backupDb"),
    cycleTitle: document.querySelector("#cycleTitle"),
    workoutTitle: document.querySelector("#workoutTitle"),
    workoutFocus: document.querySelector("#workoutFocus"),
    sessionBadge: document.querySelector("#sessionBadge"),
    emptyState: document.querySelector("#emptyState"),
    emptyTitle: document.querySelector("#emptyTitle"),
    emptyAction: document.querySelector("#emptyAction"),
    warmupGrid: document.querySelector("#warmupGrid"),
    exerciseList: document.querySelector("#exerciseList"),
    metricBoard: document.querySelector("#metricBoard"),
    sessionNotes: document.querySelector("#sessionNotes"),
    saveSessionNotes: document.querySelector("#saveSessionNotes"),
    historyList: document.querySelector("#historyList"),
    exerciseTemplate: document.querySelector("#exerciseTemplate"),
    toastHost: document.querySelector("#toastHost"),
    timerDock: document.querySelector("#timerDock"),
    timerRing: document.querySelector("#timerRing"),
    timerValue: document.querySelector("#timerValue"),
    timerLabel: document.querySelector("#timerLabel"),
    timerExercise: document.querySelector("#timerExercise"),
    timerNextText: document.querySelector("#timerNextText"),
    timerPlus: document.querySelector("#timerPlus"),
    timerMinus: document.querySelector("#timerMinus"),
    timerPause: document.querySelector("#timerPause"),
    timerSkip: document.querySelector("#timerSkip"),
    timerNext: document.querySelector("#timerNext"),
    closeTimer: document.querySelector("#closeTimer")
  });
}

export function renderStaticPlan(actions) {
  renderWorkoutTabs(actions);
  renderSafetyRules();
  renderWarmup();
}

export function renderAll(actions) {
  renderWorkoutTabs(actions);
  renderSessionPicker(actions);
  renderHero();
  renderEmptyState(actions);
  renderExercises(actions);
  renderMetrics();
  renderSessionControls();
  renderHistory(actions);
}

export function renderWorkoutTabs(actions) {
  els.workoutTabs.innerHTML = "";
  Object.entries(state.plan.workouts).forEach(([key, workout]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workout-tab ${key === state.workoutKey ? "is-active" : ""}`;
    button.dataset.accent = workout.accent || "cyan";
    button.title = `${workout.title}: ${workout.focus}`;
    button.innerHTML = `
      <div class="workout-letter">${key}</div>
      <div>
        <strong>${workout.title}</strong>
        <span class="workout-focus-text">${workout.focus}</span>
      </div>
    `;
    button.addEventListener("click", () => actions.selectWorkout(key));
    els.workoutTabs.append(button);
  });
}

function renderSafetyRules() {
  els.safetyRules.innerHTML = "";
  state.plan.cycle.safety_rules.forEach((rule) => {
    const item = document.createElement("div");
    item.className = "rule";
    item.textContent = rule;
    els.safetyRules.append(item);
  });
}

function renderWarmup() {
  els.warmupGrid.innerHTML = "";
  state.plan.warmup.forEach((step) => {
    const item = document.createElement("div");
    item.className = "warmup-item";
    item.innerHTML = `<strong>${step.name}</strong><span>${step.target}</span>`;
    els.warmupGrid.append(item);
  });
}

export function renderSessionPicker(actions) {
  els.sessionPicker.innerHTML = "";
  if (!state.sessions.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Нет сессий";
    els.sessionPicker.append(option);
    els.sessionPicker.disabled = true;
    return;
  }
  state.sessions.forEach((session) => {
    const option = document.createElement("option");
    option.value = String(session.id);
    option.textContent = formatSessionLabel(session, true);
    option.selected = Number(state.selectedSessionId) === Number(session.id);
    els.sessionPicker.append(option);
  });
  els.sessionPicker.disabled = false;
  els.sessionPicker.onchange = () => actions.selectSession(Number(els.sessionPicker.value));
}

function renderHero() {
  const workout = currentWorkout();
  const session = state.sessionData?.session;
  els.cycleTitle.textContent = state.date;
  els.workoutTitle.textContent = session
    ? `${workout.title} · ${formatSessionLabel(session, true)} · ${session.completed_at ? "Завершена" : "В работе"}`
    : workout.title;
  els.workoutFocus.textContent = workout.focus;
}

function renderEmptyState(actions) {
  const hasSession = Boolean(state.sessionData?.session);
  els.emptyState.hidden = hasSession;
  els.emptyTitle.textContent = `Сегодня еще нет тренировки ${state.workoutKey}`;
  els.emptyAction.textContent = `Начать тренировку ${state.workoutKey}`;
  els.emptyAction.onclick = actions.createSession;
}

function renderExercises(actions) {
  const session = state.sessionData?.session;
  els.exerciseList.innerHTML = "";
  if (!session) {
    return;
  }
  const workout = currentWorkout();
  workout.exercises.forEach((exercise, index) => {
    const fragment = els.exerciseTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".exercise-card");
    const meta = fragment.querySelector(".exercise-meta");
    const title = fragment.querySelector("h2");
    const comment = fragment.querySelector("p");
    const previousSummary = fragment.querySelector(".previous-summary");
    const rest = fragment.querySelector(".rest-chip");
    const setGrid = fragment.querySelector(".set-grid");
    const fillEmpty = fragment.querySelector(".fill-empty");
    const addSet = fragment.querySelector(".add-set");
    const note = fragment.querySelector(".exercise-note");
    const last = findLastPerformance(exercise.id);
    const existingSets = state.sessionData?.sets?.[exercise.id] || {};
    const maxExisting = Math.max(0, ...Object.keys(existingSets).map((value) => Number(value)));
    const rowCount = Math.max(exercise.target_sets, maxExisting);
    card.dataset.exerciseId = exercise.id;
    card.style.setProperty("--card-accent", accentColor(workout.accent));
    meta.textContent = `#${String(index + 1).padStart(2, "0")} · ${exercise.target}${last ? ` · прошлый ${last}` : ""}`;
    title.textContent = exercise.name;
    title.title = exercise.name;
    comment.textContent = exercise.comment;
    previousSummary.textContent = previousExerciseSummary(exercise.id);
    previousSummary.hidden = previousSummary.textContent === "";
    rest.textContent = formatRest(exercise.rest_seconds);
    note.value = state.sessionData?.exercise_notes?.[exercise.id] || "";

    for (let setIndex = 1; setIndex <= rowCount; setIndex += 1) {
      setGrid.append(buildSetRow(exercise, setIndex, existingSets[String(setIndex)], actions));
    }

    fillEmpty.addEventListener("click", () => {
      Promise.resolve(fillExerciseEmptySets(exercise, actions));
    });
    addSet.addEventListener("click", () => actions.addSet(exercise, rowCount + 1));
    note.addEventListener("change", () => actions.saveExerciseNote(exercise.id, note.value));
    els.exerciseList.append(fragment);
  });
  focusPending();
}

function buildSetRow(exercise, setIndex, setData, actions) {
  const row = document.createElement("div");
  const completed = Boolean(setData?.completed);
  const previous = previousSetSuggestion(exercise.id, setIndex);
  row.className = `set-row ${completed ? "is-complete" : ""}`;
  row.dataset.exerciseId = exercise.id;
  row.dataset.setIndex = String(setIndex);
  row.dataset.completed = completed ? "true" : "false";
  row.innerHTML = `
    <div class="set-number">${String(setIndex).padStart(2, "0")}</div>
    <div class="weight-cell">
      ${fieldMarkup("кг", "weight", actualSetValue(setData, "weight"), "0.5", placeholderForPrevious(previous, "weight"))}
      <button class="tiny-button weight-tools-toggle" type="button" aria-expanded="false" aria-label="Быстрый вес" title="Быстрый вес">±</button>
      <div class="weight-tools">
        <button class="tiny-button adjust-weight" data-delta="-2.5" type="button">-2.5</button>
        <button class="tiny-button adjust-weight" data-delta="2.5" type="button">+2.5</button>
      </div>
    </div>
    ${fieldMarkup("повт", "reps", actualSetValue(setData, "reps"), "1", placeholderForPrevious(previous, "reps"))}
    <label class="field">
      <span>RIR</span>
      <select data-field="rir">${rirOptions(setData?.rir)}</select>
    </label>
    <div class="set-record-cell">
      ${recordMarkup(completed, exercise, setData)}
    </div>
    <button class="delete-set" type="button" aria-label="Удалить подход" title="Удалить подход">×</button>
  `;

  row.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", () => updateRecordState(row, exercise));
    input.addEventListener("change", () => {
      if (row.dataset.setAction === "true") {
        return;
      }
      actions.saveSetDraft(exercise, setIndex, readSetRow(row), input.dataset.field);
    });
  });

  row.querySelectorAll(".adjust-weight").forEach((button) => {
    button.addEventListener("click", () => {
      const input = row.querySelector('[data-field="weight"]');
      const current = Number(input.value || 0);
      input.value = Math.max(0, current + Number(button.dataset.delta));
      input.focus();
      updateRecordState(row, exercise);
      actions.saveSetDraft(exercise, setIndex, readSetRow(row), "weight");
    });
  });

  const toolsToggle = row.querySelector(".weight-tools-toggle");
  toolsToggle.addEventListener("click", () => {
    const opened = !row.classList.contains("is-tools-open");
    row.classList.toggle("is-tools-open", opened);
    toolsToggle.setAttribute("aria-expanded", opened ? "true" : "false");
  });

  const repeatButton = row.querySelector(".repeat-set");
  if (repeatButton) {
    repeatButton.addEventListener("click", () => {
      const suggestion = bestRepeatSuggestion(exercise.id, setIndex);
      if (!suggestion) {
        showToast("Прошлый подход пока не найден", "error");
        return;
      }
      applySuggestionToRow(row, suggestion, false);
      row.querySelector('[data-field="weight"]').focus();
      updateRecordState(row, exercise);
      actions.saveSetDraft(exercise, setIndex, readSetRow(row), "weight");
    });
  }

  const recordButton = row.querySelector(".record-set");
  if (recordButton) {
    recordButton.addEventListener("pointerdown", () => {
      row.dataset.setAction = "true";
    });
    recordButton.addEventListener("click", () => {
      if (row.dataset.saving === "true" || recordButton.disabled) {
        row.dataset.setAction = "false";
        return;
      }
      row.dataset.saving = "true";
      recordButton.disabled = true;
      Promise.resolve(actions.recordSet(exercise, setIndex, readSetRow(row))).finally(() => {
        row.dataset.saving = "false";
        row.dataset.setAction = "false";
      });
    });
  }

  const uncompleteButton = row.querySelector(".uncomplete-set");
  if (uncompleteButton) {
    uncompleteButton.addEventListener("pointerdown", () => {
      row.dataset.setAction = "true";
    });
    uncompleteButton.addEventListener("click", () => {
      if (!window.confirm("Отменить выполнение подхода?")) {
        row.dataset.setAction = "false";
        return;
      }
      Promise.resolve(actions.uncompleteSet(exercise, setIndex, readSetRow(row))).finally(() => {
        row.dataset.setAction = "false";
      });
    });
  }

  const deleteButton = row.querySelector(".delete-set");
  deleteButton.addEventListener("pointerdown", () => {
    row.dataset.setAction = "true";
  });
  deleteButton.addEventListener("click", () => {
    if (row.dataset.completed === "true" && !window.confirm("Удалить выполненный подход?")) {
      row.dataset.setAction = "false";
      return;
    }
    Promise.resolve(actions.deleteSet(exercise, setIndex)).finally(() => {
      row.dataset.setAction = "false";
    });
  });

  return row;
}

function recordMarkup(completed, exercise, setData) {
  if (completed) {
    return `
      <div class="set-completed-badge" aria-label="Подход выполнен">✓ Выполнен</div>
      <button class="tiny-button uncomplete-set" type="button">Отменить</button>
    `;
  }
  const disabled = !hasPreviousValue(actualSetValue(setData, "reps")) ? " disabled" : "";
  return `
    <button class="tiny-button repeat-set" type="button" title="Повторить прошлый доступный подход">Повторить</button>
    <button class="record-set" type="button" title="Записать подход и запустить отдых" aria-label="Записать подход и запустить отдых"${disabled}>Записать</button>
    <span class="record-hint">запустит отдых ${formatRest(exercise.rest_seconds)}</span>
  `;
}

function updateRecordState(row, exercise) {
  const button = row.querySelector(".record-set");
  const hint = row.querySelector(".record-hint");
  if (!button) {
    return;
  }
  const hasReps = row.querySelector('[data-field="reps"]').value !== "";
  button.disabled = !hasReps;
  button.title = hasReps ? "Записать подход и запустить отдых" : "Введи повторы, чтобы записать подход";
  button.setAttribute("aria-label", button.title);
  if (hint) {
    hint.textContent = hasReps ? `запустит отдых ${formatRest(exercise.rest_seconds)}` : "сначала введи повторы";
  }
}

function fieldMarkup(label, field, value, step, placeholder = "") {
  const safeValue = value === null || value === undefined ? "" : value;
  const placeholderAttr = placeholder ? ` placeholder="${placeholder}"` : "";
  return `
    <label class="field">
      <span>${label}</span>
      <input data-field="${field}" type="number" min="0" step="${step}" value="${safeValue}"${placeholderAttr}>
    </label>
  `;
}

function actualSetValue(setData, field) {
  if (setData && setData[field] !== null && setData[field] !== undefined) {
    return setData[field];
  }
  return "";
}

function placeholderForPrevious(previous, field) {
  return hasPreviousValue(previous[field]) ? `прошлый ${previous[field]}` : "";
}

function hasPreviousValue(value) {
  return value !== "" && value !== null && value !== undefined;
}

function rirOptions(value) {
  const current = value === null || value === undefined ? "" : String(value);
  const options = ['<option value="">-</option>'];
  for (let option = 0; option <= 5; option += 1) {
    options.push(`<option value="${option}" ${String(option) === current ? "selected" : ""}>${option}</option>`);
  }
  return options.join("");
}

export function readSetRow(row) {
  return {
    weight: numberOrNull(row.querySelector('[data-field="weight"]').value),
    reps: intOrNull(row.querySelector('[data-field="reps"]').value),
    rir: intOrNull(row.querySelector('[data-field="rir"]').value)
  };
}

export function renderMetrics() {
  const workout = currentWorkout();
  const targetSets = workout.exercises.reduce((sum, exercise) => sum + exercise.target_sets, 0);
  const completed = currentSets().filter((set) => set.completed);
  const volume = completed.reduce((sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0);
  const reps = completed.reduce((sum, set) => sum + (Number(set.reps) || 0), 0);
  const completion = targetSets ? Math.round((completed.length / targetSets) * 100) : 0;
  const duration = sessionDurationSeconds(state.sessionData?.session);
  const longSession = Boolean(state.sessionData?.session?.running_since && !state.sessionData?.session?.completed_at && duration > 4 * 60 * 60);
  els.metricBoard.innerHTML = [
    metric("Время", formatSessionDuration(duration)),
    metric("Подходы", `${completed.length}/${targetSets}`),
    metric("Объем", `${roundVolume(volume)} кг`),
    metric("Повторы", reps),
    metric("Готово", `${Math.min(completion, 100)}%`)
  ].join("") + (longSession ? '<div class="duration-warning">Сессия идет давно</div>' : "");
}

function renderSessionControls() {
  const session = state.sessionData?.session;
  const completed = Boolean(session?.completed_at);
  els.sessionNotes.value = session?.notes || "";
  els.sessionNotes.disabled = !session;
  els.saveSessionNotes.disabled = !session;
  els.completeSession.disabled = !session;
  els.deleteSession.disabled = !session;
  els.fillWorkout.disabled = !session || completed;
  els.sessionPickerField.hidden = !state.sessions.length;
  els.newSession.textContent = session ? "Новая сессия" : `Начать тренировку ${state.workoutKey}`;
  els.completeSession.textContent = completed ? "Вернуть в работу" : "Завершить тренировку";
  els.sessionBadge.className = `status-badge ${session ? (completed ? "is-complete" : "is-active") : ""}`;
  els.sessionBadge.textContent = session ? (completed ? "Завершена" : "В работе") : "Нет сессии";
}

export function renderHistory(actions) {
  els.historyList.innerHTML = "";
  if (!state.history.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "История появится после первой созданной сессии.";
    els.historyList.append(empty);
    return;
  }

  const visibleItems = state.historyExpanded ? state.history : state.history.slice(0, 5);
  visibleItems.forEach((item) => {
    const workout = state.plan.workouts[item.workout_key];
    const card = document.createElement("div");
    card.className = `history-item ${item.completed_at ? "is-complete" : ""} ${Number(state.selectedSessionId) === Number(item.session_id) ? "is-current" : ""}`;
    card.innerHTML = `
      <div class="history-topline">
        <span>${formatSessionLabel(item)}</span>
        <span>${item.completed_at ? "завершена" : "в работе"}</span>
      </div>
      <div class="history-actions">
        <button class="history-open" type="button">
          <strong>${workout?.title || item.workout_key}</strong>
          <span>${historyDurationText(item)} · ${item.summary.sets} подходов · ${roundVolume(item.summary.volume)} кг</span>
        </button>
        <button class="history-delete" type="button" aria-label="Удалить сессию" title="Удалить сессию">Удалить</button>
      </div>
    `;
    card.querySelector(".history-open").addEventListener("click", () => actions.openHistorySession(item));
    card.querySelector(".history-delete").addEventListener("click", () => actions.deleteSession(item));
    els.historyList.append(card);
  });
  if (state.history.length > 5) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "mini-button history-more";
    more.textContent = state.historyExpanded ? "Скрыть" : `Показать еще ${state.history.length - 5}`;
    more.addEventListener("click", actions.toggleHistory);
    els.historyList.append(more);
  }
}

function currentWorkout() {
  return state.plan.workouts[state.workoutKey];
}

function currentSets() {
  return Object.values(state.sessionData?.sets || {}).flatMap((sets) => Object.values(sets));
}

export function completedSetCount() {
  return currentSets().filter((set) => set.completed).length;
}

export function hasSessionContent(sessionItem = null) {
  if (sessionItem) {
    return Boolean(sessionItem.summary?.sets || sessionItem.sets?.length || sessionItem.notes);
  }
  const session = state.sessionData?.session;
  return Boolean(session && (session.notes || currentSets().length || Object.values(state.sessionData?.exercise_notes || {}).some(Boolean)));
}

export async function fillWorkoutEmptySets(actions) {
  const workout = currentWorkout();
  let changed = 0;
  for (const exercise of workout.exercises) {
    changed += await fillExerciseEmptySets(exercise, actions, false);
  }
  if (changed === 0) {
    showToast("Нет прошлых данных для этой тренировки", "error");
  } else {
    showToast(`Заполнено полей: ${changed}`);
  }
  return changed;
}

async function fillExerciseEmptySets(exercise, actions, showEmptyToast = true) {
  const rows = Array.from(document.querySelectorAll(`[data-exercise-id="${exercise.id}"] .set-row`));
  const saves = [];
  let changed = 0;
  rows.forEach((row) => {
    if (row.dataset.completed === "true") {
      return;
    }
    const setIndex = Number(row.dataset.setIndex);
    const suggestion = bestPreviousSessionSuggestion(exercise.id, setIndex);
    if (!suggestion) {
      return;
    }
    const copied = applySuggestionToRow(row, suggestion, true);
    if (copied > 0) {
      changed += copied;
      updateRecordState(row, exercise);
      saves.push(actions.saveSetDraft(exercise, setIndex, readSetRow(row), "weight"));
    }
  });
  await Promise.all(saves);
  if (changed === 0 && showEmptyToast) {
    showToast("Нет прошлых данных для этого упражнения", "error");
  } else if (changed > 0 && showEmptyToast) {
    showToast(`Заполнено полей: ${changed}`);
  }
  return changed;
}

function previousSetSuggestion(exerciseId, setIndex) {
  return suggestionForSet(exerciseId, setIndex) || { weight: "", reps: "", rir: "" };
}

function bestRepeatSuggestion(exerciseId, setIndex) {
  return previousCompletedSetInSession(exerciseId, setIndex) || bestPreviousSessionSuggestion(exerciseId, setIndex);
}

function bestPreviousSessionSuggestion(exerciseId, setIndex) {
  return suggestionForSet(exerciseId, setIndex) || lastSuggestionForExercise(exerciseId);
}

function previousCompletedSetInSession(exerciseId, setIndex) {
  const sets = state.sessionData?.sets?.[exerciseId] || {};
  const candidates = Object.values(sets)
    .filter((set) => Number(set.set_index) < Number(setIndex) && Boolean(set.completed))
    .sort((a, b) => Number(b.set_index) - Number(a.set_index));
  const match = candidates.find((set) => hasPreviousValue(set.weight) || hasPreviousValue(set.reps) || hasPreviousValue(set.rir));
  if (!match) {
    return null;
  }
  return {
    weight: match.weight ?? "",
    reps: match.reps ?? "",
    rir: match.rir ?? "",
    source: "current_session"
  };
}

function suggestionForSet(exerciseId, setIndex) {
  return state.sessionSuggestions?.items?.[exerciseId]?.[String(setIndex)] || null;
}

function lastSuggestionForExercise(exerciseId) {
  const entries = sortedSuggestionEntries(exerciseId);
  if (!entries.length) {
    return null;
  }
  return entries[entries.length - 1].suggestion;
}

function previousExerciseSummary(exerciseId) {
  const entries = sortedSuggestionEntries(exerciseId);
  if (!entries.length) {
    return "";
  }
  const values = entries.map((entry) => formatSetBrief(entry.suggestion)).filter(Boolean);
  return values.length ? `Прошлая: ${values.join(", ")}` : "";
}

function sortedSuggestionEntries(exerciseId) {
  const suggestions = state.sessionSuggestions?.items?.[exerciseId] || {};
  return Object.entries(suggestions)
    .map(([setIndex, suggestion]) => ({ setIndex: Number(setIndex), suggestion }))
    .sort((a, b) => a.setIndex - b.setIndex);
}

function applySuggestionToRow(row, suggestion, emptyOnly) {
  let copied = 0;
  copied += applySuggestedField(row, "weight", suggestion.weight, emptyOnly);
  copied += applySuggestedField(row, "reps", suggestion.reps, emptyOnly);
  copied += applySuggestedField(row, "rir", suggestion.rir, emptyOnly);
  return copied;
}

function applySuggestedField(row, field, value, emptyOnly) {
  if (!hasPreviousValue(value)) {
    return 0;
  }
  const input = row.querySelector(`[data-field="${field}"]`);
  if (!input || (emptyOnly && hasFieldValue(input))) {
    return 0;
  }
  input.value = value;
  return 1;
}

function hasFieldValue(input) {
  return input.value !== "" && input.value !== null && input.value !== undefined;
}

function formatSetBrief(set) {
  const parts = [];
  if (hasPreviousValue(set.weight)) {
    parts.push(`${roundVolume(set.weight)} кг`);
  }
  if (hasPreviousValue(set.reps)) {
    parts.push(`${set.reps}`);
  }
  if (!parts.length) {
    return "";
  }
  return parts.length === 2 ? `${parts[0]} × ${parts[1]}` : parts.join(" ");
}

function findLastPerformance(exerciseId) {
  for (const item of state.history) {
    if (Number(item.session_id) === Number(state.selectedSessionId) || item.workout_key !== state.workoutKey) {
      continue;
    }
    const sets = item.sets || [];
    const completed = sets.filter((set) => set.exercise_id === exerciseId && set.completed && set.reps);
    if (completed.length) {
      const best = completed.slice().sort((a, b) => {
        const weightDiff = (Number(b.weight) || 0) - (Number(a.weight) || 0);
        if (weightDiff !== 0) return weightDiff;
        return (Number(b.reps) || 0) - (Number(a.reps) || 0);
      })[0];
      const weight = best.weight ? `${roundVolume(best.weight)} кг` : "вес тела";
      return `${weight} x ${best.reps || 0}`;
    }
  }
  return "";
}

function sessionDurationSeconds(session) {
  if (!session) {
    return 0;
  }
  const elapsed = Number(session.elapsed_seconds) || 0;
  if (session.completed_at || !session.running_since) {
    return Number(session.duration_seconds_live) || elapsed;
  }
  const started = Date.parse(session.running_since);
  if (!Number.isFinite(started)) {
    return Number(session.duration_seconds_live) || elapsed;
  }
  return elapsed + Math.max(0, Math.floor((Date.now() - started) / 1000));
}

function historyDurationText(item) {
  const duration = formatDurationShort(item.duration_seconds_live || item.elapsed_seconds || 0);
  return item.completed_at ? duration : `идет ${duration}`;
}

function metric(label, value) {
  return `<div class="metric"><span>${label}</span><b>${value}</b></div>`;
}

function focusPending() {
  if (!state.pendingFocus) {
    return;
  }
  focusSetInput(state.pendingFocus, state.pendingFocus.select);
  state.pendingFocus = null;
}

export function focusSetInput(target, select = false) {
  if (!target) {
    return;
  }
  const field = target.field || "weight";
  const selector = `[data-exercise-id="${target.exerciseId}"] [data-set-index="${target.setIndex}"] [data-field="${field}"]`;
  const input = document.querySelector(selector);
  if (input) {
    input.scrollIntoView({ block: "center", behavior: "smooth" });
    input.focus();
    if (select) {
      input.select?.();
    }
  }
}

function accentColor(accent) {
  if (accent === "magenta") return "var(--pink)";
  if (accent === "lime") return "var(--green)";
  if (accent === "amber") return "var(--amber)";
  return "var(--cyan)";
}

export function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast is-${type}`;
  toast.textContent = message;
  els.toastHost.append(toast);
  setTimeout(() => toast.remove(), 4200);
}

export function flash(element) {
  element.classList.remove("flash");
  void element.offsetWidth;
  element.classList.add("flash");
}
