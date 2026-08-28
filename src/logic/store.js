import { DEFAULT_SETTINGS } from "./pomodoro.js";

const KEY = "hatch.v1";

function todayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function emptyToday(now = Date.now()) {
  return { date: todayKey(now), focusedMs: 0, pomos: 0 };
}

export function emptyState() {
  return {
    tasks: [],
    activeTaskId: null,
    focusedMs: 0,
    focusCompletions: 0,
    lastEvolvedStageId: "egg",
    lastSessionEndedAt: null,
    tabGuardEnabled: true,
    pauseOnLeave: true,
    chimeOnComplete: true,
    autoStartBreaks: true,
    dailyGoalPomos: 4,
    settings: { ...DEFAULT_SETTINGS },
    today: emptyToday(),
  };
}

export function ensureToday(state, now = Date.now()) {
  const d = todayKey(now);
  if (state.today?.date === d) return state;
  return { ...state, today: emptyToday(now) };
}

export function setTabGuard(state, enabled) {
  return { ...state, tabGuardEnabled: Boolean(enabled) };
}

export function setPauseOnLeave(state, enabled) {
  return { ...state, pauseOnLeave: Boolean(enabled) };
}

export function setChimeOnComplete(state, enabled) {
  return { ...state, chimeOnComplete: Boolean(enabled) };
}

export function setAutoStartBreaks(state, enabled) {
  return { ...state, autoStartBreaks: Boolean(enabled) };
}

export function setDailyGoal(state, pomos) {
  const n = Math.min(24, Math.max(1, Number(pomos) || 4));
  return { ...state, dailyGoalPomos: n };
}

export function setTimerSettings(state, partial) {
  return {
    ...state,
    settings: { ...DEFAULT_SETTINGS, ...state.settings, ...partial },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const base = emptyState();
    return ensureToday({
      ...base,
      ...parsed,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      today: parsed.today || emptyToday(),
    });
  } catch {
    return emptyState();
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function addTask(state, title) {
  const trimmed = title.trim();
  if (!trimmed) return state;
  const task = {
    id: crypto.randomUUID(),
    title: trimmed,
    done: false,
    focusedMs: 0,
    createdAt: Date.now(),
  };
  return {
    ...state,
    tasks: [task, ...state.tasks],
    activeTaskId: state.activeTaskId ?? task.id,
  };
}

export function toggleTask(state, id) {
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  };
}

export function removeTask(state, id) {
  const tasks = state.tasks.filter((t) => t.id !== id);
  return {
    ...state,
    tasks,
    activeTaskId: state.activeTaskId === id ? tasks.find((t) => !t.done)?.id ?? null : state.activeTaskId,
  };
}

export function clearDoneTasks(state) {
  const tasks = state.tasks.filter((t) => !t.done);
  return {
    ...state,
    tasks,
    activeTaskId: tasks.some((t) => t.id === state.activeTaskId)
      ? state.activeTaskId
      : tasks[0]?.id ?? null,
  };
}

export function selectTask(state, id) {
  return { ...state, activeTaskId: id };
}

export function applyFocusCredit(state, ms) {
  if (ms <= 0) return state;
  const fresh = ensureToday(state);
  const tasks = fresh.tasks.map((t) =>
    t.id === fresh.activeTaskId ? { ...t, focusedMs: t.focusedMs + ms } : t,
  );
  return {
    ...fresh,
    tasks,
    focusedMs: fresh.focusedMs + ms,
    lastSessionEndedAt: Date.now(),
    today: {
      ...fresh.today,
      focusedMs: fresh.today.focusedMs + ms,
    },
  };
}

export function recordFocusCompletion(state) {
  const fresh = ensureToday(state);
  return {
    ...fresh,
    focusCompletions: fresh.focusCompletions + 1,
    today: { ...fresh.today, pomos: fresh.today.pomos + 1 },
  };
}

export function markEvolved(state, stageId) {
  return { ...state, lastEvolvedStageId: stageId };
}
