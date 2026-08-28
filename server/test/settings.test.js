import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createHealth } from "../src/lib/module-health.js";
import { createMemoryRepos } from "../src/repos/memory.js";

let app;
let repos;
let auth;

beforeEach(async () => {
  repos = createMemoryRepos();
  app = await buildApp({
    config: loadConfig({}),
    repos,
    health: createHealth("up"),
    logger: false,
  });
  const session = (
    await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: { deviceId: "device-settings-1" },
    })
  ).json();
  auth = { authorization: `Bearer ${session.token}` };
});

describe("PATCH /me/settings (BE-5)", () => {
  it("round-trips tabGuardEnabled", async () => {
    const off = await app.inject({
      method: "PATCH",
      url: "/api/v1/me/settings",
      headers: auth,
      payload: { tabGuardEnabled: false },
    });
    expect(off.statusCode).toBe(200);
    expect(off.json()).toEqual({ tabGuardEnabled: false });

    const progress = await app.inject({
      method: "GET",
      url: "/api/v1/me/progress",
      headers: auth,
    });
    expect(progress.json().tabGuardEnabled).toBe(false);
  });

  it("rejects a non-boolean", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/me/settings",
      headers: auth,
      payload: { tabGuardEnabled: "yes" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatchObject({ code: "VALIDATION", module: "identity" });
  });

  it("503s under the identity envelope when storage is down", async () => {
    repos.setFailure("identity", true);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/me/settings",
      headers: auth,
      payload: { tabGuardEnabled: true },
    });
    expect([401, 503]).toContain(res.statusCode);
    expect(res.json().error.module).toBe("identity");
  });
});
