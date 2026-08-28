import {
  hoursFromMs,
  petAssetPath,
  progressToNext,
  stageForMs,
} from "./logic/evolution.js";
import {
  creditFocusMs,
  DEFAULT_SETTINGS,
  durationForPhase,
  isFocusPhase,
  nextPhaseAfter,
  PHASE,
  remainingMs,
} from "./logic/pomodoro.js";
import {
  addTask,
  applyFocusCredit,
  loadState,
  markEvolved,
  recordFocusCompletion,
  removeTask,
  saveState,
  selectTask,
  setTabGuard,
  toggleTask,
} from "./logic/store.js";
import { shouldAlertOnLeave, shouldFireAgain } from "./logic/tab-guard.js";
import {
  playLeaveAlert,
  requestLeaveNotifications,
  showLeaveNotification,
  unlockAlertAudio,
} from "./logic/alert-sound.js";
import { bindInstallButton } from "./pwa.js";

const BASE = import.meta.env.BASE_URL || "./";
const PLACEHOLDER = (id) => `${BASE}pets/placeholders/${id}.svg`;

let state = loadState();
let phase = PHASE.IDLE;
let startedAt = null;
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
  btnStart: document.getElementById("btn-start"),
  btnSkip: document.getElementById("btn-skip"),
  btnReset: document.getElementById("btn-reset"),
  activeTask: document.getElementById("active-task"),
  form: document.getElementById("task-form"),
  input: document.getElementById("task-input"),
  list: document.getElementById("task-list"),
  empty: document.getElementById("empty-tasks"),
  tabGuard: document.getElementById("tab-guard"),
  tabAlertLive: document.getElementById("tab-alert-live"),
  btnInstall: document.getElementById("btn-install"),
};

function persist() {
  saveState(state);
}

function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatHours(ms) {
  const h = hoursFromMs(ms);
  if (h < 1) return `${Math.round(h * 60)} focused minutes`;
  return `${h.toFixed(2)} focused hours`;
}

function moodForPhase() {
  if (phase === PHASE.FOCUS) return "focus";
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

const STAGES_ORDER = ["egg", "hatchling", "juvenile", "fledgling", "adult", "mythic"];

function flashEvolve() {
  els.evolveFlash.hidden = false;
  window.setTimeout(() => {
    els.evolveFlash.hidden = true;
  }, 2400);
}

function liveFocusedMs() {
  if (phase === PHASE.FOCUS && startedAt) {
    return state.focusedMs + creditFocusMs(startedAt, durationForPhase(phase), Date.now());
  }
  return state.focusedMs;
}

function renderTimer() {
  const labels = {
    [PHASE.IDLE]: "Ready",
    [PHASE.FOCUS]: "Focus",
    [PHASE.SHORT_BREAK]: "Short break",
    [PHASE.LONG_BREAK]: "Long break",
  };
  els.phaseLabel.textContent = labels[phase];
  const duration = durationForPhase(phase === PHASE.IDLE ? PHASE.FOCUS : phase);
  const left = startedAt && phase !== PHASE.IDLE ? remainingMs(startedAt, duration) : duration;
  els.clock.textContent = formatClock(left);
  els.btnStart.textContent = phase === PHASE.IDLE ? "Start focus" : phase === PHASE.FOCUS ? "Running…" : "Start focus";
  els.btnStart.disabled = phase === PHASE.FOCUS || phase === PHASE.SHORT_BREAK || phase === PHASE.LONG_BREAK;
  const active = state.tasks.find((t) => t.id === state.activeTaskId);
  els.activeTask.textContent = active
    ? `Feeding hours into: ${active.title}`
    : "No task selected — hours still count for the Inklet.";
  if (els.tabGuard) els.tabGuard.checked = state.tabGuardEnabled !== false;
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

function render() {
  renderPet();
  renderTimer();
  renderTasks();
}

function settlePhase(credit) {
  if (credit && isFocusPhase(phase) && startedAt) {
    const ms = creditFocusMs(startedAt, durationForPhase(phase), Date.now());
    state = applyFocusCredit(state, ms);
    state = recordFocusCompletion(state);
    persist();
  }
  startedAt = null;
}

function begin(next) {
  phase = next;
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
  settlePhase(isFocusPhase(completed));
  if (isFocusPhase(completed)) {
    begin(nextPhaseAfter(completed, completions));
    return;
  }
  phase = PHASE.IDLE;
  startedAt = null;
  render();
}

function onTick() {
  if (!startedAt || phase === PHASE.IDLE) return;
  const duration = durationForPhase(phase);
  if (remainingMs(startedAt, duration) <= 0) {
    completeCurrent();
    return;
  }
  renderPet();
  renderTimer();
}

els.btnStart.addEventListener("click", () => {
  if (phase === PHASE.IDLE) begin(PHASE.FOCUS);
});

els.tabGuard?.addEventListener("change", () => {
  state = setTabGuard(state, els.tabGuard.checked);
  persist();
});

function fireTabLeaveAlert() {
  if (Date.now() < ignoreLeaveUntil) return;
  const enabled = state.tabGuardEnabled !== false;
  if (!shouldAlertOnLeave({ phase, tabHidden: true, enabled })) return;
  const now = Date.now();
  if (!shouldFireAgain(lastTabAlertAt, now)) return;
  lastTabAlertAt = now;
  playLeaveAlert();
  showLeaveNotification();
  if (els.tabAlertLive) {
    els.tabAlertLive.textContent = "";
    els.tabAlertLive.textContent = "You left this tab during focus. Come back.";
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") fireTabLeaveAlert();
});

window.addEventListener("pagehide", fireTabLeaveAlert);
window.addEventListener("blur", fireTabLeaveAlert);

els.btnSkip.addEventListener("click", () => {
  if (phase === PHASE.IDLE) return;
  completeCurrent();
});

els.btnReset.addEventListener("click", () => {
  if (isFocusPhase(phase) && startedAt) {
    const ms = creditFocusMs(startedAt, durationForPhase(phase), Date.now());
    state = applyFocusCredit(state, ms);
    persist();
  }
  phase = PHASE.IDLE;
  startedAt = null;
  render();
});

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  state = addTask(state, els.input.value);
  els.input.value = "";
  persist();
  render();
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

tickId = window.setInterval(onTick, 250);
bindInstallButton(els.btnInstall);
render();

window.addEventListener("beforeunload", () => {
  if (isFocusPhase(phase) && startedAt) {
    const ms = creditFocusMs(startedAt, durationForPhase(phase), Date.now());
    state = applyFocusCredit(state, ms);
    persist();
  }
  window.clearInterval(tickId);
});
