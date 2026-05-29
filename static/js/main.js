import { api } from "./api.js";
import { formatSessionLabel } from "./format.js";
import { state } from "./state.js";
import { initTimer, startRest } from "./timer.js";
import { cacheElements, completedSetCount, els, fillWorkoutEmptySets, flash, focusSetInput, hasSessionContent, renderAll, renderMetrics, renderStaticPlan, showToast } from "./render.js";

const actions = {
  selectWorkout: (key) => safe(() => selectWorkout(key)),
  selectSession: (sessionId) => safe(() => selectSession(sessionId)),
  createSession: () => safe(createSession),
  addSet: (exercise, setIndex) => safe(() => addSet(exercise, setIndex)),
  saveSetDraft: (exercise, setIndex, values, focusField) => safe(() => saveSetDraft(exercise, setIndex, values, focusField)),
  recordSet: (exercise, setIndex, values) => safe(() => recordSet(exercise, setIndex, values)),
  uncompleteSet: (exercise, setIndex, values) => safe(() => uncompleteSet(exercise, setIndex, values)),
  deleteSet: (exercise, setIndex) => safe(() => deleteSet(exercise, setIndex)),
  deleteSession: (item) => safe(() => deleteSession(item)),
  saveExerciseNote: (exerciseId, note) => safe(() => saveExerciseNote(exerciseId, note)),
  openHistorySession: (item) => safe(() => openHistorySession(item)),
  toggleHistory: () => {
    state.historyExpanded = !state.historyExpanded;
    renderAll(actions);
  }
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  initTimer(els);
  bindShell();
  els.sessionDate.value = state.date;
  await safe(async () => {
    state.plan = await api.plan();
    const savedWorkout = localStorage.getItem("fitness-tracker-workout");
    if (savedWorkout && state.plan.workouts[savedWorkout]) {
      state.workoutKey = savedWorkout;
    }
    renderStaticPlan(actions);
    await loadHistory(false);
    await loadSessionsAndSession();
  });
}

function bindShell() {
  els.sessionDate.addEventListener("change", () => safe(async () => {
    state.date = els.sessionDate.value;
    state.selectedSessionId = null;
    await loadSessionsAndSession();
  }));

  els.historyRefresh.addEventListener("click", () => safe(async () => {
    await loadHistory(true);
    showToast("История обновлена");
  }));

  els.newSession.addEventListener("click", actions.createSession);
  els.fillWorkout.addEventListener("click", () => safe(fillWorkout));
  els.completeSession.addEventListener("click", () => safe(toggleSessionCompleted));
  els.deleteSession.addEventListener("click", () => safe(() => deleteSession()));
  els.saveSessionNotes.addEventListener("click", () => safe(saveSessionNotes));
  els.backupDb.addEventListener("click", () => safe(createBackup));
  els.settingsOpen.addEventListener("click", openSettings);
  els.settingsClose.addEventListener("click", closeSettings);
  els.settingsPanel.addEventListener("click", (event) => {
    if (event.target === els.settingsPanel) {
      closeSettings();
    }
  });
  window.addEventListener("fitness-tracker:next-set", (event) => {
    focusSetInput(event.detail?.target, true);
  });
}

async function selectWorkout(key) {
  if (state.workoutKey === key) {
    return;
  }
  state.workoutKey = key;
  state.selectedSessionId = null;
  localStorage.setItem("fitness-tracker-workout", key);
  await loadSessionsAndSession();
}

async function selectSession(sessionId) {
  state.selectedSessionId = sessionId || null;
  await loadSelectedSession();
  renderAll(actions);
  syncSessionDurationTicker();
}

async function createSession() {
  const session = await api.createSession(state.date, state.workoutKey);
  state.selectedSessionId = session.id;
  await loadSessionsAndSession(session.id);
  showToast("Тренировка создана");
}

async function loadSessionsAndSession(preferredSessionId = null) {
  const data = await api.sessions(state.date, state.workoutKey);
  state.sessions = data.items || [];
  if (preferredSessionId && state.sessions.some((session) => Number(session.id) === Number(preferredSessionId))) {
    state.selectedSessionId = Number(preferredSessionId);
  } else if (state.selectedSessionId && state.sessions.some((session) => Number(session.id) === Number(state.selectedSessionId))) {
    state.selectedSessionId = Number(state.selectedSessionId);
  } else if (state.sessions.length) {
    state.selectedSessionId = Number(state.sessions[state.sessions.length - 1].id);
  } else {
    state.selectedSessionId = null;
  }
  await loadSelectedSession();
  renderAll(actions);
  syncSessionDurationTicker();
}

async function loadSelectedSession() {
  if (!state.selectedSessionId) {
    state.sessionData = null;
    state.sessionSuggestions = null;
    return;
  }
  const [sessionData, suggestions] = await Promise.all([
    api.session(state.selectedSessionId),
    api.sessionSuggestions(state.selectedSessionId)
  ]);
  state.sessionData = sessionData;
  state.sessionSuggestions = suggestions;
}

async function loadHistory(render = true) {
  const data = await api.history(80);
  state.history = data.items || [];
  if (render) {
    renderAll(actions);
  }
}

async function addSet(exercise, setIndex) {
  state.pendingFocus = {
    exerciseId: exercise.id,
    setIndex,
    field: "weight",
    select: true
  };
  await persistSet(exercise, setIndex, { weight: null, reps: null, rir: null }, false);
  renderAll(actions);
}

async function saveSetDraft(exercise, setIndex, values, focusField = null) {
  const existingSet = currentSet(exercise.id, setIndex);
  const completed = Boolean(existingSet?.completed);
  await persistSet(exercise, setIndex, values, completed);
  renderMetrics();
  queueHistoryRefresh(false);
}

async function recordSet(exercise, setIndex, values) {
  if (values.reps === null || values.reps === undefined) {
    showToast("Введи повторы, чтобы записать подход", "error");
    return;
  }
  const wasCompleted = Boolean(currentSet(exercise.id, setIndex)?.completed);
  const result = await persistSet(exercise, setIndex, values, true);
  if (!result) {
    return;
  }
  const isCompleted = Boolean(result.set?.completed);
  renderAll(actions);
  queueHistoryRefresh();
  if (wasCompleted === false && isCompleted === true) {
    const target = nextSetTarget(exercise.id, setIndex);
    startRest({
      seconds: exercise.rest_seconds,
      exerciseName: exercise.name,
      setIndex,
      nextSetIndex: target?.setIndex,
      target
    });
  }
}

async function uncompleteSet(exercise, setIndex, values) {
  await persistSet(exercise, setIndex, values, false);
  renderAll(actions);
  queueHistoryRefresh();
  showToast("Подход снова в работе");
}

async function persistSet(exercise, setIndex, values, completed) {
  if (!state.selectedSessionId) {
    showToast("Сначала создай сессию", "error");
    return null;
  }
  const result = await api.saveSet({
    session_id: state.selectedSessionId,
    exercise_id: exercise.id,
    set_index: setIndex,
    weight: values.weight,
    reps: values.reps,
    rir: values.rir,
    completed
  });
  if (!state.sessionData.sets[exercise.id]) {
    state.sessionData.sets[exercise.id] = {};
  }
  state.sessionData.sets[exercise.id][String(setIndex)] = result.set;
  return result;
}

async function deleteSet(exercise, setIndex) {
  if (!state.selectedSessionId) {
    return;
  }
  await api.deleteSet({
    session_id: state.selectedSessionId,
    exercise_id: exercise.id,
    set_index: setIndex
  });
  if (state.sessionData?.sets?.[exercise.id]) {
    delete state.sessionData.sets[exercise.id][String(setIndex)];
  }
  state.pendingFocus = {
    exerciseId: exercise.id,
    setIndex,
    field: "weight",
    select: false
  };
  renderAll(actions);
  queueHistoryRefresh();
  showToast("Подход удален");
}

async function fillWorkout() {
  const session = state.sessionData?.session;
  if (!session || session.completed_at) {
    return;
  }
  if (!window.confirm("Заполнить пустые подходы по прошлой тренировке? Уже введенные значения не изменятся.")) {
    return;
  }
  await fillWorkoutEmptySets(actions);
  renderMetrics();
  queueHistoryRefresh(false);
}

async function deleteSession(item = null) {
  const session = item
    ? {
        id: item.session_id,
        workout_key: item.workout_key,
        session_no: item.session_no,
        display_no: item.display_no,
        date: item.date
      }
    : state.sessionData?.session;
  if (!session) {
    return;
  }
  const label = formatSessionLabel(session, true);
  const content = item ? hasSessionContent(item) : hasSessionContent();
  const message = content
    ? `Удалить тренировку ${label} и все записи по ней?`
    : `Удалить тренировку ${label}?`;
  if (!window.confirm(message)) {
    return;
  }
  await api.deleteSession(session.id);
  if (Number(state.selectedSessionId) === Number(session.id)) {
    state.selectedSessionId = null;
    state.sessionData = null;
  }
  await loadHistory(false);
  await loadSessionsAndSession();
  showToast("Тренировка удалена");
}

async function toggleSessionCompleted() {
  const session = state.sessionData?.session;
  if (!session) {
    return;
  }
  const nextCompleted = !session.completed_at;
  if (nextCompleted && completedSetCount() === 0 && !window.confirm("Завершить тренировку без выполненных подходов?")) {
    return;
  }
  const result = await api.completeSession(session.id, nextCompleted);
  state.sessionData.session = result.session;
  await loadSessionsAndSession(result.session.id);
  await loadHistory(true);
  syncSessionDurationTicker();
  showToast(nextCompleted ? "Тренировка завершена" : "Тренировка снова в работе");
}

async function saveSessionNotes() {
  const session = state.sessionData?.session;
  if (!session) {
    return;
  }
  const result = await api.saveSessionNote(session.id, els.sessionNotes.value);
  state.sessionData.session = result.session;
  flash(els.saveSessionNotes);
  queueHistoryRefresh();
  showToast("Заметки сохранены");
}

async function saveExerciseNote(exerciseId, note) {
  if (!state.selectedSessionId) {
    return;
  }
  await api.saveExerciseNote(state.selectedSessionId, exerciseId, note);
  if (!state.sessionData.exercise_notes) {
    state.sessionData.exercise_notes = {};
  }
  state.sessionData.exercise_notes[exerciseId] = note;
  showToast("Заметка по упражнению сохранена");
}

async function openHistorySession(item) {
  state.date = item.date;
  state.workoutKey = item.workout_key;
  state.selectedSessionId = item.session_id;
  localStorage.setItem("fitness-tracker-workout", state.workoutKey);
  els.sessionDate.value = state.date;
  await loadSessionsAndSession(item.session_id);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function createBackup() {
  await api.backup();
  closeSettings();
  showToast("Резервная копия создана");
}

function openSettings() {
  els.settingsPanel.hidden = false;
}

function closeSettings() {
  els.settingsPanel.hidden = true;
}

function queueHistoryRefresh(render = true) {
  clearTimeout(state.historyRefreshTimer);
  state.historyRefreshTimer = setTimeout(() => {
    loadHistory(render).catch((error) => showToast(error.message, "error"));
  }, 350);
}

function syncSessionDurationTicker() {
  clearInterval(state.sessionDurationTimer);
  state.sessionDurationTimer = null;
  const session = state.sessionData?.session;
  if (!session || session.completed_at || !session.running_since) {
    return;
  }
  state.sessionDurationTimer = setInterval(() => {
    renderMetrics();
  }, 1000);
}

function currentSet(exerciseId, setIndex) {
  return state.sessionData?.sets?.[exerciseId]?.[String(setIndex)];
}

function nextSetTarget(exerciseId, setIndex) {
  const workout = state.plan.workouts[state.workoutKey];
  const exerciseIndex = workout.exercises.findIndex((exercise) => exercise.id === exerciseId);
  const exercise = workout.exercises[exerciseIndex];
  const existingSets = state.sessionData?.sets?.[exerciseId] || {};
  const maxExisting = Math.max(0, ...Object.keys(existingSets).map((value) => Number(value)));
  const rowCount = Math.max(exercise.target_sets, maxExisting);
  if (setIndex + 1 <= rowCount) {
    return {
      exerciseId,
      setIndex: setIndex + 1,
      field: "weight"
    };
  }
  const nextExercise = workout.exercises[exerciseIndex + 1];
  if (!nextExercise) {
    return null;
  }
  return {
    exerciseId: nextExercise.id,
    setIndex: 1,
    field: "weight"
  };
}

async function safe(work) {
  try {
    await work();
  } catch (error) {
    showToast(error.message || String(error), "error");
  }
}
