export const PHASE = {
  IDLE: "idle",
  FOCUS: "focus",
  SHORT_BREAK: "short_break",
  LONG_BREAK: "long_break",
};

export const DEFAULT_SETTINGS = {
  focusMs: 25 * 60 * 1000,
  shortBreakMs: 5 * 60 * 1000,
  longBreakMs: 15 * 60 * 1000,
  longBreakEvery: 4,
};

export function durationForPhase(phase, settings = DEFAULT_SETTINGS) {
  if (phase === PHASE.FOCUS) return settings.focusMs;
  if (phase === PHASE.SHORT_BREAK) return settings.shortBreakMs;
  if (phase === PHASE.LONG_BREAK) return settings.longBreakMs;
  return 0;
}

export function isFocusPhase(phase) {
  return phase === PHASE.FOCUS;
}

/**
 * After a completed phase, choose the next one.
 * Focus completions increment the cycle count; only then may a long break fire.
 */
export function nextPhaseAfter(completedPhase, focusCompletions, settings = DEFAULT_SETTINGS) {
  if (completedPhase === PHASE.FOCUS) {
    const n = focusCompletions + 1;
    if (n > 0 && n % settings.longBreakEvery === 0) return PHASE.LONG_BREAK;
    return PHASE.SHORT_BREAK;
  }
  return PHASE.FOCUS;
}

export function remainingMs(startedAt, durationMs, now = Date.now()) {
  return Math.max(0, durationMs - (now - startedAt));
}

export function elapsedMs(startedAt, now = Date.now()) {
  return Math.max(0, now - startedAt);
}

/** Credit only actual elapsed focus time, capped at the planned duration. */
export function creditFocusMs(startedAt, durationMs, now = Date.now()) {
  return Math.min(durationMs, elapsedMs(startedAt, now));
}
