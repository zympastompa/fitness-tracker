export const state = {
  plan: null,
  workoutKey: "A",
  date: todayISO(),
  sessions: [],
  selectedSessionId: null,
  sessionData: null,
  sessionSuggestions: null,
  history: [],
  historyExpanded: false,
  pendingFocus: null,
  historyRefreshTimer: null,
  sessionDurationTimer: null
};

export function todayISO() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}
