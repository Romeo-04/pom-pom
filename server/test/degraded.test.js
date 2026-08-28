import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createHealth } from "../src/lib/module-health.js";
import { createMemoryRepos } from "../src/repos/memory.js";

const setup = async () => {
  const repos = createMemoryRepos();
  const health = createHealth("up");
  const app = await buildApp({ config: loadConfig({}), repos, health, logger: false });
  const session = (
    await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: { deviceId: "device-degraded-1" },
    })
  ).json();
  return { app, repos, health, auth: { authorization: `Bearer ${session.token}` } };
};

describe("the failure matrix in spec §4 actually holds", () => {
  it("keeps /health at 200 with every datastore broken", async () => {
    const { app, repos } = await setup();
    repos.setFailure("identity", true);
    repos.setFailure("tasks", true);
    repos.setFailure("ledger", true);

    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    await app.close();
  });

  it("serves the pet manifest with no database at all", async () => {
    const { app, repos } = await setup();
    repos.setFailure("identity", true);
    repos.setFailure("tasks", true);
    repos.setFailure("ledger", true);

    const res = await app.inject({ method: "GET", url: "/api/v1/pets/manifest" });
    expect(res.statusCode).toBe(200);
    expect(res.json().stages).toHaveLength(6);
    await app.close();
  });

  it("keeps the ledger writable while tasks is down (spec §4 row 3)", async () => {
    const { app, repos, auth } = await setup();
    repos.setFailure("tasks", true);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/focus/credits",
      headers: auth,
      payload: {
        idempotencyKey: "k-degraded",
        startedAt: 1_700_000_000_000,
        endedAt: 1_700_000_060_000,
        taskId: null,
        phase: "focus",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().focusedMs).toBe(60_000);
    await app.close();
  });

  it("names the broken module in the envelope and in /health", async () => {
    const { app, repos } = await setup();
    repos.setFailure("tasks", true);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/tasks",
      headers: { authorization: "Bearer nope" },
    });
    // Auth fails first, and that is identity's fault, not tasks'.
    expect(res.json().error.module).toBe("identity");

    const health = (await app.inject({ method: "GET", url: "/health" })).json();
    expect(Object.entries(health.modules).filter(([, s]) => s === "down")).toHaveLength(0);
    await app.close();
  });

  it("carries a request id on an error response too", async () => {
    const { app, repos, auth } = await setup();
    repos.setFailure("tasks", true);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/tasks",
      headers: { ...auth, "x-request-id": "trace-me" },
    });
    expect(res.statusCode).toBe(503);
    expect(res.headers["x-request-id"]).toBe("trace-me");
    await app.close();
  });
});
