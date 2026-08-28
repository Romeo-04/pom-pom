import {
  hoursFromMs,
  petAssetPath,
  progressToNext,
  STAGES,
  stageForMs,
} from "./logic/evolution.js";
import {
  creditFocusMs,
  DEFAULT_SETTINGS,
  durationForPhase,
  isFocusPhase,
  nextPhaseAfter,
  pauseSlice,
  PHASE,
  remainingMs,
} from "./logic/pomodoro.js";
import {
  addTask,
  applyFocusCredit,
  clearDoneTasks,
  loadState,
  markEvolved,
  recordFocusCompletion,
  removeTask,
  saveState,
  selectTask,
  setAutoStartBreaks,
  setChimeOnComplete,
  setDailyGoal,
  setPauseOnLeave,
  setTabGuard,
  setTimerSettings,
  toggleTask,
} from "./logic/store.js";
import { shouldAlertOnLeave, shouldFireAgain } from "./logic/tab-guard.js";
import {
  playCompleteChime,
  playLeaveAlert,
  requestLeaveNotifications,
  showLeaveNotification,
  stopLeaveAlert,
  unlockAlertAudio,
} from "./logic/alert-sound.js";
import { bindInstallButton } from "./pwa.js";
import { patchSettings, queueCredit, queueTask, startSync } from "./sync.js";

const BASE = import.meta.env.BASE_URL || "./";
const PLACEHOLDER = (id) => `${BASE}pets/placeholders/${id}.svg`;
const STAGES_ORDER = ["egg", "hatchling", "juvenile", "fledgling", "adult", "mythic"];
const PRESETS = {
  classic: { focusMs: 25 * 60 * 1000, shortBreakMs: 5 * 60 * 1000, longBreakMs: 15 * 60 * 1000 },
  long: { focusMs: 50 * 60 * 1000, shortBreakMs: 10 * 60 * 1000, longBreakMs: 20 * 60 * 1000 },
  sprint: { focusMs: 15 * 60 * 1000, shortBreakMs: 3 * 60 * 1000, longBreakMs: 10 * 60 * 1000 },
};

let state = loadState();
let phase = PHASE.IDLE;
let startedAt = null;
let runDuration = 0;
let pausedLeft = null;
let tickId = null;
let lastTabAlertAt = 0;
let ignoreLeaveUntil = 0;

const els = {
  petImg: document.getElementById("pet-img"),
  petName: document.getElementById("pet-name"),
  petHours: document.getElementById("pet-hours"),
  petNext: document.getElementById("pet-next"),
  meterFill: document.getElementById("meter-fill"),
  evolveFlash: document.getElementById("evolve-flash"),
  phaseLabel: document.getElementById("phase-label"),
  clock: document.getElementById("clock"),
  cycleMeta: document.getElementById("cycle-meta"),
  btnStart: document.getElementById("btn-start"),
  btnPause: document.getElementById("btn-pause"),
  btnSkip: document.getElementById("btn-skip"),
  btnReset: document.getElementById("btn-reset"),
  activeTask: document.getElementById("active-task"),
  form: document.getElementById("task-form"),
  input: document.getElementById("task-input"),
  list: document.getElementById("task-list"),
  empty: document.getElementById("empty-tasks"),
  syncStatus: document.getElementById("sync-status"),
  tabGuard: document.getElementById("tab-guard"),
  tabAlertLive: document.getElementById("tab-alert-live"),
  btnInstall: document.getElementById("btn-install"),
  setFocus: document.getElementById("set-focus"),
  setShort: document.getElementById("set-short"),
  setLong: document.getElementById("set-long"),
  setEvery: document.getElementById("set-every"),
  setGoal: document.getElementById("set-goal"),
  setAutostart: document.getElementById("set-autostart"),
  setChime: document.getElementById("set-chime"),
  setPauseLeave: document.getElementById("set-pause-leave"),
  statPomos: document.getElementById("stat-pomos"),
  statMinutes: document.getElementById("stat-minutes"),
  statHours: document.getElementById("stat-hours"),
  statHoursUnit: document.getElementById("stat-hours-unit"),
  statGoal: document.getElementById("stat-goal"),
  goalFill: document.getElementById("goal-fill"),
  btnClearDone: document.getElementById("btn-clear-done"),
  evoPath: document.getElementById("evo-path"),
  evoStanding: document.getElementById("evo-standing"),
};

function persist() {
  saveState(state);
}

function settings() {
  return { ...DEFAULT_SETTINGS, ...state.settings };
}

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatHours(ms) {
  const h = hoursFromMs(ms);
  if (h < 1) return `${Math.round(h * 60)} focused minutes`;
  return `${h.toFixed(2)} focused hours`;
}

function isRunning() {
  return Boolean(startedAt) && phase !== PHASE.IDLE;
}

function isPaused() {
  return pausedLeft != null && phase !== PHASE.IDLE;
}

function moodForPhase() {
  if (phase === PHASE.FOCUS && isRunning()) return "focus";
  if (phase === PHASE.SHORT_BREAK || phase === PHASE.LONG_BREAK) return "rest";
  return "idle";
}

function setPetSrc(stageId) {
  const mood = moodForPhase();
  const preferred = petAssetPath(stageId, mood, BASE);
  const fallbackIdle = petAssetPath(stageId, "idle", BASE);
  const img = els.petImg;
  img.dataset.stage = stageId;
  img.onerror = () => {
    if (img.src.includes(preferred) && mood !== "idle") {
      img.src = fallbackIdle;
      return;
    }
    img.src = PLACEHOLDER(stageId);
    img.onerror = null;
  };
  img.src = preferred;
}

function renderPet() {
  const liveMs = liveFocusedMs();
  const stage = stageForMs(liveMs);
  const progress = progressToNext(hoursFromMs(liveMs));
  const prev = state.lastEvolvedStageId;
  if (stage.id !== prev) {
    state = markEvolved(state, stage.id);
    persist();
    if (prev && STAGES_ORDER.indexOf(stage.id) > STAGES_ORDER.indexOf(prev)) {
      flashEvolve();
    }
  }
  setPetSrc(stage.id);
  els.petImg.alt = `Inklet at ${stage.name} stage`;
  els.petName.textContent = stage.name;
  els.petHours.textContent = formatHours(liveMs);
  els.meterFill.style.width = `${progress.ratio * 100}%`;
  if (!progress.next) {
    els.petNext.textContent = "Mythic form — keep stacking hours if you want.";
  } else {
    els.petNext.textContent = `${progress.hoursNeeded.toFixed(2)} h until ${progress.next.name}`;
  }
}

function flashEvolve() {
  els.evolveFlash.hidden = false;
  window.setTimeout(() => {
    els.evolveFlash.hidden = true;
  }, 2400);
}

function liveFocusedMs() {
  if (phase === PHASE.FOCUS && startedAt) {
    return state.focusedMs + creditFocusMs(startedAt, runDuration, Date.now());
  }
  return state.focusedMs;
}

function displayRemaining() {
  if (isPaused()) return pausedLeft;
  if (isRunning()) return remainingMs(startedAt, runDuration);
  return durationForPhase(PHASE.FOCUS, settings());
}

function renderTimer() {
  const labels = {
    [PHASE.IDLE]: "Ready",
    [PHASE.FOCUS]: isPaused() ? "Focus paused" : "Focus",
    [PHASE.SHORT_BREAK]: isPaused() ? "Break paused" : "Short break",
    [PHASE.LONG_BREAK]: isPaused() ? "Break paused" : "Long break",
  };
  els.phaseLabel.textContent = labels[phase] ?? "Ready";
  els.clock.textContent = formatClock(displayRemaining());
  const untilLong = settings().longBreakEvery - (state.focusCompletions % settings().longBreakEvery);
  els.cycleMeta.textContent = `${untilLong} focus${untilLong === 1 ? "" : "es"} until a long break`;

  const running = isRunning();
  els.btnStart.textContent = isPaused()
    ? "Resume"
    : phase === PHASE.IDLE
      ? "Start Focus"
      : running && phase !== PHASE.FOCUS
        ? "Running…"
        : "Start Focus";
  els.btnStart.disabled = running;
  els.btnPause.disabled = !running;

  const active = state.tasks.find((t) => t.id === state.activeTaskId);
  els.activeTask.textContent = active
    ? `Feeding hours into: ${active.title}`
    : "No task selected — hours still count for the Inklet.";
  if (els.tabGuard) els.tabGuard.checked = state.tabGuardEnabled !== false;
  if (els.setPauseLeave) els.setPauseLeave.checked = state.pauseOnLeave !== false;
  if (els.setChime) els.setChime.checked = state.chimeOnComplete !== false;
  if (els.setAutostart) els.setAutostart.checked = state.autoStartBreaks !== false;
  if (els.setFocus) els.setFocus.value = String(Math.round(settings().focusMs / 60000));
  if (els.setShort) els.setShort.value = String(Math.round(settings().shortBreakMs / 60000));
  if (els.setLong) els.setLong.value = String(Math.round(settings().longBreakMs / 60000));
  if (els.setEvery) els.setEvery.value = String(settings().longBreakEvery);
  if (els.setGoal) els.setGoal.value = String(state.dailyGoalPomos || 4);
}

function renderStats() {
  const today = state.today || { focusedMs: 0, pomos: 0 };
  const goal = state.dailyGoalPomos || 4;
  const mins = Math.round(today.focusedMs / 60000);
  const hours = today.focusedMs / 3600000;
  els.statPomos.textContent = String(today.pomos);
  els.statMinutes.textContent = String(mins);
  if (els.statHours) {
    els.statHours.textContent = hours >= 1 ? hours.toFixed(1) : String(mins);
  }
  if (els.statHoursUnit) {
    els.statHoursUnit.textContent = hours >= 1 ? "h" : "m";
  }
  els.statGoal.textContent = `${today.pomos} / ${goal}`;
  els.goalFill.style.width = `${Math.min(1, today.pomos / goal) * 100}%`;
}

function renderTasks() {
  els.list.replaceChildren();
  els.empty.hidden = state.tasks.length > 0;
  for (const task of state.tasks) {
    const li = document.createElement("li");
    li.className = "task-item";
    if (task.id === state.activeTaskId) li.classList.add("is-active");
    if (task.done) li.classList.add("is-done");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = task.done;
    check.setAttribute("aria-label", `Complete ${task.title}`);
    check.addEventListener("change", () => {
      state = toggleTask(state, task.id);
      persist();
      renderTasks();
    });

    const title = document.createElement("p");
    title.className = "task-title";
    title.textContent = task.title;

    const meta = document.createElement("span");
    meta.className = "task-meta";
    meta.textContent = task.focusedMs ? `${Math.round(hoursFromMs(task.focusedMs) * 60)} min` : "";

    const select = document.createElement("button");
    select.type = "button";
    select.className = "btn btn-secondary btn-tiny";
    select.textContent = task.id === state.activeTaskId ? "Active" : "Focus this";
    select.addEventListener("click", () => {
      state = selectTask(state, task.id);
      persist();
      render();
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn btn-ghost btn-tiny";
    del.textContent = "Remove";
    del.addEventListener("click", () => {
      state = removeTask(state, task.id);
      persist();
      render();
    });

    li.append(check, title, meta, select, del);
    els.list.append(li);
  }
}

function renderEvolution() {
  if (!els.evoPath) return;
  const liveMs = liveFocusedMs();
  const hours = hoursFromMs(liveMs);
  const current = stageForMs(liveMs);

  els.evoPath.replaceChildren();
  for (const stage of STAGES) {
    const li = document.createElement("li");
    li.className = "evo-stage";
    const reached = hours >= stage.hours;
    if (reached) li.classList.add("is-reached");
    if (stage.id === current.id) {
      li.classList.add("is-current");
      li.setAttribute("aria-current", "step");
    }

    const name = document.createElement("span");
    name.className = "evo-stage-name";
    name.textContent = stage.name;

    const cost = document.createElement("span");
    cost.className = "evo-stage-cost";
    cost.textContent = stage.hours === 0 ? "from the start" : `${stage.hours} focused h`;

    li.append(name, cost);
    els.evoPath.append(li);
  }

  if (!els.evoStanding) return;
  const progress = progressToNext(hours);
  els.evoStanding.textContent = progress.next
    ? `${current.name} now — ${progress.hoursNeeded.toFixed(2)} h until ${progress.next.name}.`
    : `${current.name} — the last stage. Keep stacking hours if you want.`;
}

function render() {
  renderPet();
  renderTimer();
  renderStats();
  renderTasks();
  renderEvolution();
}

function pauseRunning() {
  if (!isRunning()) return false;
  const now = Date.now();
  const slice = pauseSlice(startedAt, runDuration, now);
  if (isFocusPhase(phase) && slice.elapsed > 0) {
    state = applyFocusCredit(state, slice.elapsed);
    persist();
    queueCredit({ startedAt, endedAt: now });
  }
  pausedLeft = slice.remaining;
  startedAt = null;
  return true;
}

function resumeRunning() {
  if (!isPaused() || pausedLeft <= 0) {
    begin(phase === PHASE.IDLE ? PHASE.FOCUS : phase);
    return;
  }
  runDuration = pausedLeft;
  pausedLeft = null;
  startedAt = Date.now();
  if (isFocusPhase(phase)) {
    ignoreLeaveUntil = Date.now() + 1600;
    unlockAlertAudio();
  }
  render();
}

function begin(next) {
  phase = next;
  pausedLeft = null;
  runDuration = durationForPhase(next, settings());
  startedAt = Date.now();
  if (isFocusPhase(next)) {
    ignoreLeaveUntil = Date.now() + 1600;
    unlockAlertAudio();
    requestLeaveNotifications();
  }
  render();
}

function completeCurrent() {
  const completed = phase;
  const completions = state.focusCompletions;
  if (isFocusPhase(completed) && startedAt) {
    const now = Date.now();
    const ms = creditFocusMs(startedAt, runDuration, now);
    state = applyFocusCredit(state, ms);
    state = recordFocusCompletion(state);
    persist();
    queueCredit({ startedAt, endedAt: now });
  }
  startedAt = null;
  pausedLeft = null;
  if (state.chimeOnComplete !== false) playCompleteChime();

  if (isFocusPhase(completed)) {
    const next = nextPhaseAfter(completed, completions, settings());
    if (state.autoStartBreaks !== false) {
      begin(next);
      return;
    }
    phase = PHASE.IDLE;
    render();
    return;
  }
  phase = PHASE.IDLE;
  render();
}

function onTick() {
  if (!isRunning()) return;
  if (remainingMs(startedAt, runDuration) <= 0) {
    completeCurrent();
    return;
  }
  renderPet();
  renderTimer();
  renderStats();
  renderEvolution();
}

function pauseBecauseLeftTab() {
  if (state.pauseOnLeave === false) return;
  if (!isRunning()) return;
  pauseRunning();
  render();
}

els.btnStart.addEventListener("click", () => {
  if (isPaused()) resumeRunning();
  else if (phase === PHASE.IDLE) begin(PHASE.FOCUS);
});

els.btnPause.addEventListener("click", () => {
  pauseRunning();
  render();
});

els.tabGuard?.addEventListener("change", () => {
  state = setTabGuard(state, els.tabGuard.checked);
  persist();
  if (els.tabGuard.checked) {
    unlockAlertAudio();
    requestLeaveNotifications();
  } else {
    stopLeaveAlert();
  }
  patchSettings({ tabGuardEnabled: els.tabGuard.checked }).catch(() => {});
});

function fireTabLeaveAlert() {
  if (Date.now() < ignoreLeaveUntil) return;
  const enabled = state.tabGuardEnabled !== false;
  if (!shouldAlertOnLeave({ tabHidden: true, enabled })) return;
  const now = Date.now();
  if (!shouldFireAgain(lastTabAlertAt, now)) return;
  lastTabAlertAt = now;
  playLeaveAlert();
  showLeaveNotification();
  if (els.tabAlertLive) {
    els.tabAlertLive.textContent = "";
    els.tabAlertLive.textContent = "Timer paused. Elapsed focus was saved.";
  }
}

function armTabAlarm() {
  unlockAlertAudio();
}

document.addEventListener("pointerdown", armTabAlarm, { once: true });
document.addEventListener("keydown", armTabAlarm, { once: true });

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    pauseBecauseLeftTab();
    fireTabLeaveAlert();
  } else {
    stopLeaveAlert();
  }
});

window.addEventListener("pagehide", () => {
  pauseBecauseLeftTab();
  fireTabLeaveAlert();
});

els.btnSkip.addEventListener("click", () => {
  if (phase === PHASE.IDLE && !isPaused()) return;
  if (isPaused()) {
    pausedLeft = null;
    phase = PHASE.IDLE;
    render();
    return;
  }
  completeCurrent();
});

els.btnReset.addEventListener("click", () => {
  if (isFocusPhase(phase) && startedAt) {
    const now = Date.now();
    const ms = creditFocusMs(startedAt, runDuration, now);
    state = applyFocusCredit(state, ms);
    persist();
    queueCredit({ startedAt, endedAt: now });
  }
  phase = PHASE.IDLE;
  startedAt = null;
  pausedLeft = null;
  render();
});

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = els.input.value.trim();
  state = addTask(state, title);
  els.input.value = "";
  persist();
  render();
  if (title) queueTask({ title });
});

els.btnClearDone?.addEventListener("click", () => {
  state = clearDoneTasks(state);
  persist();
  render();
});

function minutesField(el, key) {
  el?.addEventListener("change", () => {
    const mins = Math.min(90, Math.max(1, Number(el.value) || 1));
    state = setTimerSettings(state, { [key]: mins * 60 * 1000 });
    persist();
    if (!isRunning() && !isPaused()) render();
  });
}

minutesField(els.setFocus, "focusMs");
minutesField(els.setShort, "shortBreakMs");
minutesField(els.setLong, "longBreakMs");

els.setEvery?.addEventListener("change", () => {
  state = setTimerSettings(state, { longBreakEvery: Math.min(12, Math.max(2, Number(els.setEvery.value) || 4)) });
  persist();
  renderTimer();
});

els.setGoal?.addEventListener("change", () => {
  state = setDailyGoal(state, els.setGoal.value);
  persist();
  renderStats();
  renderTimer();
});

els.setAutostart?.addEventListener("change", () => {
  state = setAutoStartBreaks(state, els.setAutostart.checked);
  persist();
});

els.setChime?.addEventListener("change", () => {
  state = setChimeOnComplete(state, els.setChime.checked);
  persist();
});

els.setPauseLeave?.addEventListener("change", () => {
  state = setPauseOnLeave(state, els.setPauseLeave.checked);
  persist();
});

document.querySelectorAll("[data-preset]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const preset = PRESETS[btn.dataset.preset];
    if (!preset) return;
    state = setTimerSettings(state, preset);
    persist();
    render();
  });
});

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SUMMARY") return;
  e.preventDefault();
  if (isRunning()) {
    pauseRunning();
    render();
  } else if (isPaused() || phase === PHASE.IDLE) {
    if (isPaused()) resumeRunning();
    else begin(PHASE.FOCUS);
  }
});

const debug = document.createElement("button");
debug.type = "button";
debug.className = "btn btn-ghost";
debug.style.marginTop = "16px";
debug.textContent = "Add 1 focused hour (preview evolution)";
debug.addEventListener("click", () => {
  state = applyFocusCredit(state, 60 * 60 * 1000);
  persist();
  render();
});
document.querySelector(".pet-well")?.append(debug);

document.querySelectorAll("[data-nav]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.nav;
    document.querySelectorAll(".panel").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== id;
    });
    document.querySelectorAll("[data-nav]").forEach((nav) => {
      const active = nav === btn;
      nav.classList.toggle("is-active", active);
      if (active) nav.setAttribute("aria-current", "page");
      else nav.removeAttribute("aria-current");
    });
  });
});

function updateSyncStatus(status) {
  if (!els.syncStatus) return;
  const labels = {
    synced: "Synced",
    pending: "Syncing…",
    offline: "Saved on this device only",
  };
  els.syncStatus.textContent = labels[status] ?? "";
  els.syncStatus.classList.toggle("is-synced", status === "synced");
  els.syncStatus.classList.toggle("is-offline", status === "offline");
  els.syncStatus.hidden = false;
}

tickId = window.setInterval(onTick, 250);
bindInstallButton(els.btnInstall);
startSync({ onStatusChange: updateSyncStatus });
render();

window.addEventListener("beforeunload", () => {
  if (isFocusPhase(phase) && startedAt) {
    const now = Date.now();
    const ms = creditFocusMs(startedAt, runDuration, now);
    state = applyFocusCredit(state, ms);
    persist();
    queueCredit({ startedAt, endedAt: now });
  }
  window.clearInterval(tickId);
});
