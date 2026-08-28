import { issueToken, hashToken } from "../lib/auth.js";
import { guard } from "../lib/guard.js";
import { validation } from "../lib/errors.js";

const MODULE = "identity";

/** BE-1. Guest identity: a deviceId in, an opaque token out (spec §3.2). */
export default async function identityModule(app) {
  app.post(
    "/sessions",
    { config: { module: MODULE } },
    async (request) =>
      guard(MODULE, app.health, async () => {
        const deviceId = request.body?.deviceId;
        if (typeof deviceId !== "string" || deviceId.trim().length < 8) {
          throw validation(MODULE, "deviceId must be a string of at least 8 characters");
        }
        const token = issueToken();
        const { userId } = await app.repos.users.createSession({
          deviceId: deviceId.trim(),
          tokenHash: hashToken(token),
          now: Date.now(),
        });
        return { userId, token };
      }),
  );
}
