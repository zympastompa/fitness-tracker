export function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short"
  }).format(date);
}

export function formatSessionLabel(session, compact = false) {
  const prefix = compact ? "" : `${formatDate(session.date)} · `;
  const number = session.display_no ?? session.session_no;
  return `${prefix}${session.workout_key} #${number}`;
}

export function formatRest(seconds) {
  if (seconds < 60) {
    return `${seconds}с`;
  }
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return restSeconds ? `${minutes}:${String(restSeconds).padStart(2, "0")}` : `${minutes}:00`;
}

export function formatClock(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

export function formatSessionDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const restSeconds = safeSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(restSeconds).padStart(2, "0")}`;
}

export function formatDurationShort(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0 && minutes > 0) {
    return `${hours}ч ${minutes}м`;
  }
  if (hours > 0) {
    return `${hours}ч`;
  }
  return `${Math.max(1, minutes)}м`;
}

export function roundVolume(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

export function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  return Number(value);
}

export function intOrNull(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  return Number.parseInt(value, 10);
}
