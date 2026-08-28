import { createHash } from "node:crypto";
import { creditFocusMs, stageForMs } from "hatch-core";
import { requireUser } from "../lib/auth.js";
import { conflict, validation } from "../lib/errors.js";
import { bestEffort, guard, withTimeout } from "../lib/guard.js";

const MODULE = "ledger";

const isInt = (value) => Number.isInteger(value);

/** Canonical fingerprint of a credit body — what makes a retry a retry (spec §3.4). */
export const creditBodyHash = ({ startedAt, endedAt, taskId, phase }) =>
  createHash("sha256")
    .update(JSON.stringify([startedAt, endedAt, taskId ?? null, phase]))
    .digest("hex");

/**
 * One credit, validated and stored. Shared by POST /focus/credits and POST /sync/batch
 * so the two paths can never disagree about capping or idempotency.
 * Throws AppError (VALIDATION / CONFLICT); the caller decides status vs. per-item error.
 */
export async function applyCredit(app, request, body) {
  const { idempotencyKey, startedAt, endedAt, taskId = null, phase } = body ?? {};

  if (phase !== "focus") {
    throw validation(MODULE, 'phase must be "focus" — breaks are never credited');
  }
  if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
    throw validation(MODULE, "idempotencyKey is required");
  }
  if (!isInt(startedAt) || !isInt(endedAt)) {
    throw validation(MODULE, "startedAt and endedAt must be integer epoch milliseconds");
  }
  if (endedAt < startedAt) {
    throw validation(MODULE, "endedAt must not precede startedAt");
  }
  if (taskId !== null && typeof taskId !== "string") {
    throw validation(MODULE, "taskId must be a string or null");
  }

  const focusedMs = creditFocusMs(startedAt, app.config.plannedFocusMs, endedAt);
  const bodyHash = creditBodyHash({ startedAt, endedAt, taskId, phase });

  const result = await app.repos.ledger.insertCredit({
    userId: request.user.id,
    idempotencyKey,
    bodyHash,
    startedAt,
    endedAt,
    taskId,
    focusedMs,
    now: Date.now(),
  });

  if (!result.inserted && result.bodyHash !== bodyHash) {
    throw conflict(MODULE, "idempotencyKey already used with a different body");
  }

  // Cross-module write: tasks owns its own table and its own failure (spec §6).
  // Losing this must never lose the user's hours, so it is best-effort with a timeout.
  if (result.inserted && taskId) {
    const credited = await bestEffort("tasks", app.health, () =>
      withTimeout(
        app.repos.tasks.addFocus(request.user.id, taskId, focusedMs),
        app.config.timeoutMs,
        "tasks",
      ),
    );
    if (!credited) {
      request.log.warn(
        { module: "tasks", taskId, requestId: request.id },
        "credit stored but task focusedMs not updated",
      );
    }
  }

  return { focusedMs: result.focusedMs };
}

/**
 * BE-3. The only writer of "real" hours when online.
 * Credit math lives in hatch-core; this module validates, de-duplicates, and stores.
 */
export default async function ledgerModule(app) {
  const routeOpts = { preHandler: requireUser(app), config: { module: MODULE } };

  app.post("/focus/credits", routeOpts, async (request) =>
    guard(MODULE, app.health, async () => {
      const { focusedMs } = await applyCredit(app, request, request.body);
      return {
        accepted: true,
        focusedMs,
        totalFocusedMs: await app.repos.ledger.totalFocusedMs(request.user.id),
      };
    }),
  );

  app.get("/me/progress", routeOpts, async (request) =>
    guard(MODULE, app.health, async () => {
      const totalFocusedMs = await app.repos.ledger.totalFocusedMs(request.user.id);

      // Settings live in identity. If that module is down the pet still evolves —
      // fall back to the tab-guard default rather than failing progress.
      let tabGuardEnabled = request.user.tabGuardEnabled ?? true;
      await bestEffort("identity", app.health, async () => {
        const settings = await withTimeout(
          app.repos.users.getSettings(request.user.id),
          app.config.timeoutMs,
          "identity",
        );
        tabGuardEnabled = settings.tabGuardEnabled;
      });

      return {
        totalFocusedMs,
        stageId: stageForMs(totalFocusedMs).id,
        tabGuardEnabled,
      };
    }),
  );
}
