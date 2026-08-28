import { requireUser } from "../lib/auth.js";
import { validation } from "../lib/errors.js";
import { guard } from "../lib/guard.js";

// Settings live on the users row, so they report under the identity module.
const MODULE = "identity";

/** BE-5. The server-side half of FE-8's tab-guard checkbox (spec §3.5). */
export default async function settingsModule(app) {
  app.patch(
    "/me/settings",
    { preHandler: requireUser(app), config: { module: MODULE } },
    async (request) =>
      guard(MODULE, app.health, async () => {
        const { tabGuardEnabled } = request.body ?? {};
        if (typeof tabGuardEnabled !== "boolean") {
          throw validation(MODULE, "tabGuardEnabled must be a boolean");
        }
        return app.repos.users.updateSettings(request.user.id, { tabGuardEnabled });
      }),
  );
}
