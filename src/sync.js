// Best-effort mirror of local progress to the Hatch API (docs/fe-be-task-assignment.md §3).
// Sync is a plugin, not the core: every export here is additive to the local-first
// flow in main.js/store.js. If this module throws, is offline, or the API is down,
// the timer, tasks, and pet keep working purely on localStorage — callers never await
// these functions on the hot path (Start focus, add task, etc).

const API_BASE = import.meta.env.VITE_API_BASE || "https://pompom-one.vercel.app";
const DEVICE_KEY = "hatch.deviceId";
const TOKEN_KEY = "hatch.token";
const OUTBOX_KEY = "hatch.outbox.v1";
const TIMEOUT_MS = 3000;
const FLUSH_INTERVAL_MS = 15000;

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "content-type": "application/json" };
  if (auth) {
    const token = getToken();
    if (!token) throw new Error("no session token");
    headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  return data;
}

export async function checkHealth() {
  return api("/health", { auth: false });
}

export async function ensureSession() {
  if (getToken()) return true;
  const { token } = await api("/api/v1/sessions", {
    method: "POST",
    auth: false,
    body: { deviceId: getDeviceId() },
  });
  localStorage.setItem(TOKEN_KEY, token);
  return true;
}

export async function patchSettings(partial) {
  await ensureSession();
  return api("/api/v1/me/settings", { method: "PATCH", body: partial });
}

function loadOutbox() {
  try {
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY));
    return {
      credits: Array.isArray(raw?.credits) ? raw.credits : [],
      tasks: Array.isArray(raw?.tasks) ? raw.tasks : [],
    };
  } catch {
    return { credits: [], tasks: [] };
  }
}

function saveOutbox(outbox) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
}

/** Queue one elapsed focus slice. Idempotency key matches spec §3.4 (userId is implied by the token). */
export function queueCredit({ startedAt, endedAt }) {
  if (!(endedAt > startedAt)) return;
  const outbox = loadOutbox();
  const idempotencyKey = `${getDeviceId()}:${startedAt}`;
  if (outbox.credits.some((c) => c.idempotencyKey === idempotencyKey)) return;
  outbox.credits.push({ idempotencyKey, startedAt, endedAt, taskId: null, phase: "focus" });
  saveOutbox(outbox);
}

export function queueTask({ title }) {
  if (!title?.trim()) return;
  const outbox = loadOutbox();
  outbox.tasks.push({ title: title.trim() });
  saveOutbox(outbox);
}

export function hasQueuedWork() {
  const outbox = loadOutbox();
  return outbox.credits.length > 0 || outbox.tasks.length > 0;
}

/** Drain the outbox via POST /sync/batch. Keeps only items worth retrying (spec §6 BE-6: per-item result). */
export async function flushOutbox() {
  const outbox = loadOutbox();
  if (outbox.credits.length === 0 && outbox.tasks.length === 0) return { flushed: 0 };

  await ensureSession();
  const result = await api("/api/v1/sync/batch", { method: "POST", body: outbox });

  const retryable = (r) => r && !r.ok && r.error?.code === "UNAVAILABLE";
  const keptCredits = outbox.credits.filter((_, i) => retryable(result.credits[i]));
  const keptTasks = outbox.tasks.filter((_, i) => retryable(result.tasks[i]));
  saveOutbox({ credits: keptCredits, tasks: keptTasks });

  return { flushed: outbox.credits.length - keptCredits.length + outbox.tasks.length - keptTasks.length };
}

/**
 * Boot the sync plugin: check /health, size up the outbox, flush on an interval and
 * whenever the browser comes back online. `onStatusChange(status)` fires with
 * "synced" | "offline" | "pending" so the caller can render a small indicator —
 * never anything that blocks or reflows the timer.
 */
export function startSync({ onStatusChange } = {}) {
  let usable = false;

  const report = (status) => onStatusChange?.(status);

  const tick = async () => {
    try {
      const health = await checkHealth();
      usable = health.modules.identity !== "down" && health.modules.ledger !== "down";
      if (!usable) return report("offline");
      const { flushed } = await flushOutbox();
      report(hasQueuedWork() ? "pending" : "synced");
      return flushed;
    } catch {
      usable = false;
      report("offline");
    }
  };

  tick();
  const intervalId = window.setInterval(tick, FLUSH_INTERVAL_MS);
  window.addEventListener("online", tick);

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener("online", tick);
  };
}
