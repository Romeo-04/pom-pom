import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { unauthorized } from "./errors.js";

/** Opaque bearer token: 32 random bytes, hex. Never stored in plaintext. */
export const issueToken = () => randomBytes(32).toString("hex");

export const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export const sameToken = (a, b) => {
  const bufA = Buffer.from(a ?? "", "utf8");
  const bufB = Buffer.from(b ?? "", "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};

const readBearer = (request) => {
  const header = request.headers.authorization ?? "";
  const [scheme, value] = header.split(" ");
  if (!value || scheme.toLowerCase() !== "bearer") return null;
  return value.trim();
};

/**
 * preHandler for every authenticated route. Fails closed on auth (spec §1) but is
 * attributed to "identity" so the client knows which module to distrust.
 */
export function requireUser(app) {
  return async (request) => {
    const token = readBearer(request);
    if (!token) throw unauthorized("identity");

    let user = null;
    try {
      user = await app.repos.users.findByTokenHash(hashToken(token));
    } catch {
      app.health.markDown("identity");
      throw unauthorized("identity", "identity storage unavailable");
    }
    if (!user) throw unauthorized("identity");
    request.user = user;
  };
}
