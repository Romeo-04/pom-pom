import { requireUser } from "../lib/auth.js";
import { validation } from "../lib/errors.js";
import { guard } from "../lib/guard.js";

const MODULE = "tasks";

/** BE-2. Task CRUD (spec §3.3). focusedMs is denormalised here; the ledger is its writer. */
export default async function tasksModule(app) {
  const routeOpts = { preHandler: requireUser(app), config: { module: MODULE } };

  app.get("/tasks", routeOpts, async (request) =>
    guard(MODULE, app.health, async () => ({
      tasks: await app.repos.tasks.list(request.user.id),
    })),
  );

  app.post("/tasks", routeOpts, async (request) =>
    guard(MODULE, app.health, async () => {
      const title = request.body?.title;
      if (typeof title !== "string" || title.trim().length === 0) {
        throw validation(MODULE, "title is required");
      }
      if (title.trim().length > 200) {
        throw validation(MODULE, "title must be 200 characters or fewer");
      }
      return app.repos.tasks.create(request.user.id, {
        title: title.trim(),
        now: Date.now(),
      });
    }),
  );

  app.patch("/tasks/:id", routeOpts, async (request) =>
    guard(MODULE, app.health, async () => {
      const { done, active } = request.body ?? {};
      if (done === undefined && active === undefined) {
        throw validation(MODULE, "patch requires done or active");
      }
      if (done !== undefined && typeof done !== "boolean") {
        throw validation(MODULE, "done must be a boolean");
      }
      if (active !== undefined && typeof active !== "boolean") {
        throw validation(MODULE, "active must be a boolean");
      }
      return app.repos.tasks.patch(request.user.id, request.params.id, { done, active });
    }),
  );

  app.delete("/tasks/:id", routeOpts, async (request) =>
    guard(MODULE, app.health, async () => {
      const removed = await app.repos.tasks.remove(request.user.id, request.params.id);
      if (!removed) throw validation(MODULE, "unknown task id");
      return { ok: true };
    }),
  );
}
