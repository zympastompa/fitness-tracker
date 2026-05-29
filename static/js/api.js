async function request(path, options = {}) {
  const fetchOptions = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json"
    }
  };
  if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, fetchOptions);
  const contentType = response.headers.get("Content-Type") || "";
  const data = contentType.includes("application/json") ? await response.json() : {};
  if (!response.ok) {
    const message = data?.error?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export function fetchSessionSuggestions(sessionId) {
  const query = new URLSearchParams({ session_id: String(sessionId) });
  return request(`/api/session-suggestions?${query.toString()}`);
}

export const api = {
  plan() {
    return request("/api/plan");
  },
  health() {
    return request("/api/health");
  },
  sessions(date, workoutKey) {
    const query = new URLSearchParams({ date, workout: workoutKey });
    return request(`/api/sessions?${query.toString()}`);
  },
  session(sessionId) {
    const query = new URLSearchParams({ id: String(sessionId) });
    return request(`/api/session?${query.toString()}`);
  },
  sessionSuggestions(sessionId) {
    return fetchSessionSuggestions(sessionId);
  },
  createSession(date, workoutKey) {
    return request("/api/sessions", {
      method: "POST",
      body: { date, workout_key: workoutKey }
    });
  },
  history(limit = 80) {
    const query = new URLSearchParams({ limit: String(limit) });
    return request(`/api/history?${query.toString()}`);
  },
  saveSet(payload) {
    return request("/api/set", {
      method: "POST",
      body: payload
    });
  },
  deleteSet(payload) {
    return request("/api/delete-set", {
      method: "POST",
      body: payload
    });
  },
  deleteSession(sessionId) {
    return request("/api/delete-session", {
      method: "POST",
      body: { session_id: sessionId }
    });
  },
  completeSession(sessionId, completed) {
    return request("/api/complete-session", {
      method: "POST",
      body: { session_id: sessionId, completed }
    });
  },
  saveSessionNote(sessionId, notes) {
    return request("/api/session-note", {
      method: "POST",
      body: { session_id: sessionId, notes }
    });
  },
  saveExerciseNote(sessionId, exerciseId, notes) {
    return request("/api/exercise-note", {
      method: "POST",
      body: { session_id: sessionId, exercise_id: exerciseId, notes }
    });
  },
  backup() {
    return request("/api/backup", {
      method: "POST",
      body: {}
    });
  }
};
