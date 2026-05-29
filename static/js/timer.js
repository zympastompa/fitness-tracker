import { formatClock } from "./format.js";

let els = {};
let timer = null;
let interval = null;
let audioContext = null;
let floating = false;

export function initTimer(elements) {
  els = elements;
  els.closeTimer.addEventListener("click", closeTimer);
  els.timerPlus.addEventListener("click", () => adjustTimer(30));
  els.timerMinus.addEventListener("click", () => adjustTimer(-15));
  els.timerPause.addEventListener("click", pauseResumeTimer);
  els.timerSkip.addEventListener("click", () => finishTimer(false));
  els.timerNext.addEventListener("click", goToNext);
  els.timerDock.addEventListener("click", handleTimerDockClick);
  window.addEventListener("scroll", updateFloatingTimer, { passive: true });
  window.addEventListener("resize", updateFloatingTimer);
  renderIdle();
}

export function startRest(context) {
  clearInterval(interval);
  interval = null;
  const {
    seconds,
    exerciseName,
    setIndex,
    nextSetIndex,
    target
  } = context || {};
  const duration = normalizeRestSeconds(seconds);
  if (!duration) {
    return;
  }
  timer = {
    mode: "running",
    total: duration,
    remaining: duration,
    endAt: Date.now() + duration * 1000,
    exerciseName,
    setIndex,
    nextSetIndex,
    target,
    paused: false,
    done: false
  };
  els.timerDock.classList.remove("is-idle", "is-done");
  els.timerDock.classList.add("is-running");
  els.timerLabel.textContent = "Отдых";
  els.timerExercise.textContent = `После подхода ${setIndex} · ${exerciseName}`;
  els.timerNextText.textContent = nextSetText(nextSetIndex);
  els.timerPause.textContent = "Пауза";
  setRunningControls();
  tick();
  interval = setInterval(tick, 250);
  updateFloatingTimer();
}

export function normalizeRestSeconds(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  return Math.round(duration);
}

export function remainingSeconds(endAt, now = Date.now()) {
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

function tick() {
  if (!timer || timer.paused || timer.done) {
    return;
  }
  timer.remaining = remainingSeconds(timer.endAt);
  renderTimer();
  if (timer.remaining <= 0) {
    finishTimer(true);
  }
}

function adjustTimer(delta) {
  if (!timer || timer.done) {
    return;
  }
  timer.remaining = Math.max(0, timer.remaining + delta);
  timer.total = Math.max(timer.total, timer.remaining);
  timer.endAt = Date.now() + timer.remaining * 1000;
  renderTimer();
  if (timer.remaining <= 0) {
    finishTimer(false);
  }
}

function pauseResumeTimer() {
  if (!timer || timer.done) {
    return;
  }
  if (!timer.paused) {
    timer.remaining = remainingSeconds(timer.endAt);
  }
  timer.paused = !timer.paused;
  if (!timer.paused) {
    timer.endAt = Date.now() + timer.remaining * 1000;
  }
  els.timerPause.textContent = timer.paused ? "Продолжить" : "Пауза";
  renderTimer();
}

function finishTimer(playSignal = true) {
  if (!timer || timer.done) {
    return;
  }
  clearInterval(interval);
  interval = null;
  timer.remaining = 0;
  timer.done = true;
  timer.mode = "done";
  els.timerDock.classList.remove("is-idle");
  els.timerDock.classList.remove("is-running");
  els.timerDock.classList.add("is-done");
  els.timerLabel.textContent = "Можно продолжать";
  els.timerExercise.textContent = doneTitle(timer.nextSetIndex);
  els.timerNextText.textContent = timer.exerciseName || "";
  els.timerValue.textContent = "00:00";
  els.timerRing.style.background = "conic-gradient(var(--green) 360deg, rgba(255, 255, 255, 0.1) 0deg)";
  setDoneControls();
  updateFloatingTimer();
  if (playSignal) {
    beep();
  }
}

function closeTimer() {
  clearInterval(interval);
  interval = null;
  timer = null;
  renderIdle();
}

function renderIdle() {
  els.timerDock.classList.add("is-idle");
  els.timerDock.classList.remove("is-done", "is-running");
  els.timerLabel.textContent = "Перерыв";
  els.timerExercise.textContent = "Отдых появится после записи подхода";
  els.timerNextText.textContent = "";
  els.timerValue.textContent = "00:00";
  els.timerPause.textContent = "Пауза";
  els.timerRing.style.background = "conic-gradient(var(--cyan) 0deg, rgba(255, 255, 255, 0.1) 0deg)";
  setIdleControls();
  setFloating(false);
}

function renderTimer() {
  if (!timer) {
    return;
  }
  const progress = timer.total ? Math.max(0, Math.min(1, (timer.total - timer.remaining) / timer.total)) : 0;
  els.timerValue.textContent = formatClock(timer.remaining);
  els.timerRing.style.background = `conic-gradient(var(--cyan) ${progress * 360}deg, rgba(255, 255, 255, 0.1) 0deg)`;
}

function nextSetText(nextSetIndex) {
  return nextSetIndex ? `Следующий: подход ${nextSetIndex}` : "Следующее: новое упражнение";
}

function doneTitle(nextSetIndex) {
  return nextSetIndex ? `Пора к подходу ${nextSetIndex}` : "Пора к следующему упражнению";
}

function setRunningControls() {
  els.timerMinus.hidden = false;
  els.timerPlus.hidden = false;
  els.timerPause.hidden = false;
  els.timerSkip.hidden = false;
  els.timerNext.hidden = true;
}

function setDoneControls() {
  els.timerMinus.hidden = true;
  els.timerPlus.hidden = true;
  els.timerPause.hidden = true;
  els.timerSkip.hidden = true;
  els.timerNext.hidden = false;
  els.timerNext.textContent = "К подходу";
}

function setIdleControls() {
  els.timerMinus.hidden = false;
  els.timerPlus.hidden = false;
  els.timerPause.hidden = false;
  els.timerSkip.hidden = false;
  els.timerNext.hidden = true;
}

function goToNext() {
  if (!timer?.done) {
    return;
  }
  goToTarget();
  closeTimer();
}

function handleTimerDockClick(event) {
  if (event.target.closest("button")) {
    return;
  }
  if (!timer) {
    return;
  }
  goToTarget();
}

function goToTarget() {
  const target = timer.target;
  if (target) {
    window.dispatchEvent(new CustomEvent("fitness-tracker:next-set", {
      detail: { target }
    }));
  }
}

function updateFloatingTimer() {
  if (!timer) {
    setFloating(false);
    return;
  }
  const shouldFloat = window.scrollY > 360;
  setFloating(shouldFloat);
}

function setFloating(value) {
  if (floating === value) {
    return;
  }
  floating = value;
  els.timerDock.classList.toggle("is-floating", floating);
  els.timerDock.classList.toggle("is-mini-timer", floating);
  document.body.classList.toggle("has-floating-timer", floating);
}

function beep() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }
  audioContext = audioContext || new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.32);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.onended = () => {
    if (audioContext) {
      audioContext.close().finally(() => {
        audioContext = null;
      });
    }
  };
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.34);
}
