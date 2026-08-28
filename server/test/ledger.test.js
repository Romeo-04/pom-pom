import { beforeEach, describe, expect, it } from "vitest";
import { MS_PER_HOUR } from "hatch-core";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createHealth } from "../src/lib/module-health.js";
import { createMemoryRepos } from "../src/repos/memory.js";

let app;
let repos;
let health;
let auth;
let userId;

const START = 1_700_000_000_000;

beforeEach(async () => {
  repos = createMemoryRepos();
  health = createHealth("up");
  app = await buildApp({ config: loadConfig({}), repos, health, logger: false });
  const session = (
    await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: { deviceId: "device-ledger-01" },
    })
  ).json();
  auth = { authorization: `Bearer ${session.token}` };
  userId = session.userId;
});

const credit = (over = {}) =>
  app.inject({
    method: "POST",
    url: "/api/v1/focus/credits",
    headers: auth,
    payload: {
      idempotencyKey: `${userId}:${START}`,
      startedAt: START,
      endedAt: START + 25 * 60 * 1000,
      taskId: null,
      phase: "focus",
      ...over,
    },
  });

describe("POST /focus/credits (BE-3)", () => {
  it("accepts a full pomodoro", async () => {
    const res = await credit();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      accepted: true,
      focusedMs: 25 * 60 * 1000,
      totalFocusedMs: 25 * 60 * 1000,
    });
  });

  it("credits only elapsed time on an early stop", async () => {
    const res = await credit({ endedAt: START + 6 * 60 * 1000 });
    expect(res.json().focusedMs).toBe(6 * 60 * 1000);
  });

  it("caps an overlong session at the planned 25 minutes", async () => {
    const res = await credit({ endedAt: START + 90 * 60 * 1000 });
    expect(res.json().focusedMs).toBe(25 * 60 * 1000);
  });

  it("rejects a break phase with 400", async () => {
    for (const phase of ["short_break", "long_break", "idle"]) {
      const res = await credit({ phase });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatchObject({ code: "VALIDATION", module: "ledger" });
    }
  });

  it("rejects endedAt before startedAt and non-integer times", async () => {
    expect((await credit({ endedAt: START - 1 })).statusCode).toBe(400);
    expect((await credit({ startedAt: "yesterday" })).statusCode).toBe(400);
  });

  it("rejects a missing idempotencyKey", async () => {
    const res = await credit({ idempotencyKey: undefined });
    expect(res.statusCode).toBe(400);
  });

  it("does not double-feed the pet on a retry of the identical body", async () => {
    const first = (await credit()).json();
    const retry = await credit();
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual(first);

    const progress = await app.inject({
      method: "GET",
      url: "/api/v1/me/progress",
      headers: auth,
    });
    expect(progress.json().totalFocusedMs).toBe(25 * 60 * 1000);
  });

  it("409s when the same key arrives with a different body", async () => {
    await credit();
    const res = await credit({ endedAt: START + 10 * 60 * 1000 });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatchObject({ code: "CONFLICT", module: "ledger" });
  });

  it("accumulates distinct keys", async () => {
    await credit();
    const second = await credit({
      idempotencyKey: `${userId}:${START + 3_600_000}`,
      startedAt: START + 3_600_000,
      endedAt: START + 3_600_000 + 25 * 60 * 1000,
    });
    expect(second.json().totalFocusedMs).toBe(50 * 60 * 1000);
  });

  it("credits the named task's focusedMs", async () => {
    const task = (
      await app.inject({
        method: "POST",
        url: "/api/v1/tasks",
        headers: auth,
        payload: { title: "thesis" },
      })
    ).json();
    await credit({ taskId: task.id });
    const tasks = (await app.inject({ method: "GET", url: "/api/v1/tasks", headers: auth })).json();
    expect(tasks.tasks[0].focusedMs).toBe(25 * 60 * 1000);
  });

  it("still credits the user when the tasks module is broken", async () => {
    const task = (
      await app.inject({
        method: "POST",
        url: "/api/v1/tasks",
        headers: auth,
        payload: { title: "thesis" },
      })
    ).json();
    repos.setFailure("tasks", true);
    const res = await credit({ taskId: task.id });
    expect(res.statusCode).toBe(200);
    expect(res.json().focusedMs).toBe(25 * 60 * 1000);
    expect(health.get("tasks")).toBe("down");
    expect(health.get("ledger")).toBe("up");
  });
});

describe("GET /me/progress (BE-3)", () => {
  it("starts at egg with zero hours", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/me/progress", headers: auth });
    expect(res.json()).toEqual({ totalFocusedMs: 0, stageId: "egg", tabGuardEnabled: true });
  });

  it("reports the stage id from hatch-core thresholds", async () => {
    // Two hours of focus is exactly the hatchling threshold.
    for (let i = 0; i < 5; i += 1) {
      const startedAt = START + i * 3_600_000;
      await credit({
        idempotencyKey: `${userId}:${startedAt}`,
        startedAt,
        endedAt: startedAt + 24 * 60 * 1000,
      });
    }
    const res = await app.inject({ method: "GET", url: "/api/v1/me/progress", headers: auth });
    expect(res.json().totalFocusedMs).toBe(2 * MS_PER_HOUR);
    expect(res.json().stageId).toBe("hatchling");
  });

  it("fails closed on auth when identity storage is fully down (spec §1)", async () => {
    repos.setFailure("identity", true);
    const res = await app.inject({ method: "GET", url: "/api/v1/me/progress", headers: auth });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatchObject({ code: "UNAUTHORIZED", module: "identity" });
  });

  it("still reports hours when only the settings read is broken", async () => {
    // Auth resolves, then getSettings throws. bestEffort must swallow it and keep the
    // default rather than costing the user their progress.
    const partial = createMemoryRepos();
    const session = await partial.users.createSession({
      deviceId: "device-partial-1",
      tokenHash: "unused",
      now: START,
    });
    partial.users.getSettings = async () => {
      throw new Error("settings read exploded");
    };
    partial.users.findByTokenHash = async () => ({ id: session.userId, tabGuardEnabled: true });

    const partialHealth = createHealth("up");
    const partialApp = await buildApp({
      config: loadConfig({}),
      repos: partial,
      health: partialHealth,
      logger: false,
    });
    const res = await partialApp.inject({
      method: "GET",
      url: "/api/v1/me/progress",
      headers: { authorization: "Bearer anything" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ totalFocusedMs: 0, stageId: "egg", tabGuardEnabled: true });
    expect(partialHealth.get("identity")).toBe("down");
    expect(partialHealth.get("ledger")).toBe("up");
    await partialApp.close();
  });
});

describe("ledger 503 path (spec §8.3)", () => {
  it("returns the ledger envelope and leaves tasks up", async () => {
    repos.setFailure("ledger", true);
    const res = await credit();
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toMatchObject({ code: "UNAVAILABLE", module: "ledger" });

    const healthRes = await app.inject({ method: "GET", url: "/health" });
    expect(healthRes.json().modules).toMatchObject({ ledger: "down", tasks: "up" });
  });
});
