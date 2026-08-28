import { PHASE } from "./pomodoro.js";

export const TAB_ALERT_COOLDOWN_MS = 8_000;

export function shouldAlertOnLeave({ phase, tabHidden, enabled }) {
  return Boolean(enabled) && phase === PHASE.FOCUS && tabHidden === true;
}

export function shouldFireAgain(lastFiredAt, now, cooldownMs = TAB_ALERT_COOLDOWN_MS) {
  if (!lastFiredAt) return true;
  return now - lastFiredAt >= cooldownMs;
}
