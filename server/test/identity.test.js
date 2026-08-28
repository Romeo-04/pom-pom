import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createHealth } from "../src/lib/module-health.js";
import { createMemoryRepos } from "../src/repos/memory.js";

const setup = async () => {
  const repos = createMemoryRepos();
  const health = createHealth("up");
  const app = await buildApp({ config: loadConfig({}), repos, health, logger: false });
  return { app, repos, health };
};

describe("POST /sessions (BE-1)", () => {
  it("issues a userId and token for a deviceId", async () => {
    const { app } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: { deviceId: "11111111-1111-4111-8111-111111111111" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    await app.close();
  });

  it("returns the same userId for a repeat deviceId with a fresh token", async () => {
    const { app } = await setup();
    const payload = { deviceId: "22222222-2222-4222-8222-222222222222" };
    const first = (await app.inject({ method: "POST", url: "/api/v1/sessions", payload })).json();
    const second = (await app.inject({ method: "POST", url: "/api/v1/sessions", payload })).json();
    expect(second.userId).toBe(first.userId);
    expect(second.token).not.toBe(first.token);
    await app.close();
  });

  it("rejects a missing deviceId as VALIDATION", async () => {
    const { app } = await setup();
    const res = await app.inject({ method: "POST", url: "/api/v1/sessions", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION");
    expect(res.json().error.module).toBe("identity");
    await app.close();
  });

  it("answers 503 with the identity envelope and flips health when storage is down", async () => {
    const { app, repos, health } = await setup();
    repos.setFailure("identity", true);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: { deviceId: "33333333-3333-4333-8333-333333333333" },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toMatchObject({ code: "UNAVAILABLE", module: "identity" });
    expect(health.get("identity")).toBe("down");

    // The whole process stays up: /health still answers 200 and other modules are untouched.
    const still = await app.inject({ method: "GET", url: "/health" });
    expect(still.statusCode).toBe(200);
    expect(still.json().modules).toMatchObject({ identity: "down", tasks: "up", ledger: "up" });
    await app.close();
  });
});

describe("bearer auth", () => {
  it("401s with no header", async () => {
    const { app } = await setup();
    const res = await app.inject({ method: "GET", url: "/api/v1/tasks" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatchObject({ code: "UNAUTHORIZED", module: "identity" });
    await app.close();
  });

  it("401s on an unknown token", async () => {
    const { app } = await setup();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/tasks",
      headers: { authorization: "Bearer deadbeef" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
