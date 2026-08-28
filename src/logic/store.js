const KEY = "hatch.v1";

export function emptyState() {
  return {
    tasks: [],
    activeTaskId: null,
    focusedMs: 0,
    focusCompletions: 0,
    lastEvolvedStageId: "egg",
    lastSessionEndedAt: null,
    tabGuardEnabled: true,
  };
}

export function setTabGuard(state, enabled) {
  return { ...state, tabGuardEnabled: Boolean(enabled) };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed, tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] };
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

export function selectTask(state, id) {
  return { ...state, activeTaskId: id };
}

export function applyFocusCredit(state, ms) {
  if (ms <= 0) return state;
  const tasks = state.tasks.map((t) =>
    t.id === state.activeTaskId ? { ...t, focusedMs: t.focusedMs + ms } : t,
  );
  return {
    ...state,
    tasks,
    focusedMs: state.focusedMs + ms,
    lastSessionEndedAt: Date.now(),
  };
}

export function recordFocusCompletion(state) {
  return { ...state, focusCompletions: state.focusCompletions + 1 };
}

export function markEvolved(state, stageId) {
  return { ...state, lastEvolvedStageId: stageId };
}
