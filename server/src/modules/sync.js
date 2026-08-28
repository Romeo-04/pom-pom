import { requireUser } from "../lib/auth.js";
import { AppError, validation } from "../lib/errors.js";
import { applyCredit } from "./ledger.js";

const MODULE = "ledger";
const MAX_ITEMS = 200;

const asError = (error, fallbackModule) =>
  error instanceof AppError
    ? error.toEnvelope().error
    : { code: "UNAVAILABLE", message: error?.message ?? "failed", module: fallbackModule };

/**
 * BE-6. Drains FE-4's outbox. Always 200: one bad credit must not reject the whole
 * body (spec §6 BE-6), because the client cannot tell which item the server hated
 * from a single status code.
 */
export default async function syncModule(app) {
  app.post(
    "/sync/batch",
    { preHandler: requireUser(app), config: { module: MODULE } },
    async (request) => {
      const credits = request.body?.credits ?? [];
      const tasks = request.body?.tasks ?? [];

      if (!Array.isArray(credits) || !Array.isArray(tasks)) {
        throw validation(MODULE, "credits and tasks must be arrays");
      }
      if (credits.length + tasks.length > MAX_ITEMS) {
        throw validation(MODULE, `batch may contain at most ${MAX_ITEMS} items`);
      }

      const creditResults = [];
      for (const item of credits) {
        try {
          const { focusedMs } = await applyCredit(app, request, item);
          creditResults.push({ idempotencyKey: item?.idempotencyKey ?? null, ok: true, focusedMs });
        } catch (error) {
          creditResults.push({
            idempotencyKey: item?.idempotencyKey ?? null,
            ok: false,
            error: asError(error, "ledger"),
          });
        }
      }

      const taskResults = [];
      for (const [index, item] of tasks.entries()) {
        try {
          const title = item?.title;
          if (typeof title !== "string" || title.trim().length === 0) {
            throw validation("tasks", "title is required");
          }
          const task = await app.repos.tasks.create(request.user.id, {
            title: title.trim(),
            now: Date.now(),
          });
          taskResults.push({ index, ok: true, task });
        } catch (error) {
          taskResults.push({ index, ok: false, error: asError(error, "tasks") });
        }
      }

      // A total we cannot read is null, not a failed request — the per-item results
      // above are what the outbox needs in order to clear itself.
      let totalFocusedMs = null;
      try {
        totalFocusedMs = await app.repos.ledger.totalFocusedMs(request.user.id);
      } catch {
        app.health.markDown("ledger");
      }

      return { credits: creditResults, tasks: taskResults, totalFocusedMs };
    },
  );
}
