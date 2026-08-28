import { AppError, unavailable } from "./errors.js";

/** Reject with a module-attributed 503 if a promise outruns the 3s budget (spec §6 BE-0). */
export function withTimeout(promise, ms, module) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(unavailable(module, `timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * The per-module try/catch. Each route body runs inside its own guard so a broken
 * table in one module cannot 500 another (spec §6 "must not ... share one try/catch").
 * An AppError is a deliberate answer and passes through; anything else means the
 * module's datastore surprised us, so flip its health flag and answer 503.
 */
export async function guard(module, health, fn) {
  try {
    const result = await fn();
    health.markUp(module);
    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    health.markDown(module);
    throw unavailable(module, error?.message ?? "module unavailable");
  }
}

/**
 * Call into ANOTHER module. Never throws — the caller's own response must not depend
 * on it. Returns whether the side effect landed, so the caller can log it.
 */
export async function bestEffort(module, health, fn) {
  try {
    await fn();
    health.markUp(module);
    return true;
  } catch {
    health.markDown(module);
    return false;
  }
}
