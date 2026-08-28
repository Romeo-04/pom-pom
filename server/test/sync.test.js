import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createHealth } from "../src/lib/module-health.js";
import { createMemoryRepos } from "../src/repos/memory.js";

let app;
let repos;
let auth;
const START = 1_700_000_000_000;

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
      payload: { deviceId: "device-sync-001" },
    })
  ).json();
  auth = { authorization: `Bearer ${session.token}` };
});

const batch = (payload) =>
  app.inject({ method: "POST", url: "/api/v1/sync/batch", headers: auth, payload });

describe("POST /sync/batch (BE-6)", () => {
  it("drains a mixed outbox and reports per item", async () => {
    const res = await batch({
      credits: [
        { idempotencyKey: "a", startedAt: START, endedAt: START + 60_000, taskId: null, phase: "focus" },
        { idempotencyKey: "b", startedAt: START, endedAt: START + 60_000, taskId: null, phase: "short_break" },
        { idempotencyKey: "c", startedAt: START + 1, endedAt: START + 60_001, taskId: null, phase: "focus" },
      ],
      tasks: [{ title: "revise" }, { title: "" }],
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.credits.map((c) => c.ok)).toEqual([true, false, true]);
    expect(body.credits[1].error).toMatchObject({ code: "VALIDATION", module: "ledger" });
    expect(body.tasks.map((t) => t.ok)).toEqual([true, false]);
    expect(body.tasks[1].error).toMatchObject({ code: "VALIDATION", module: "tasks" });
    expect(body.totalFocusedMs).toBe(120_000);
  });

  it("is idempotent — replaying the same batch changes no total", async () => {
    const payload = {
      credits: [
        { idempotencyKey: "a", startedAt: START, endedAt: START + 60_000, taskId: null, phase: "focus" },
      ],
    };
    await batch(payload);
    const again = await batch(payload);
    expect(again.json().totalFocusedMs).toBe(60_000);
    expect(again.json().credits[0].ok).toBe(true);
  });

  it("accepts an empty body", async () => {
    const res = await batch({});
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ credits: [], tasks: [], totalFocusedMs: 0 });
  });

  it("rejects an oversized batch", async () => {
    const credits = Array.from({ length: 201 }, (_, i) => ({
      idempotencyKey: `k${i}`,
      startedAt: START + i,
      endedAt: START + i + 1000,
      taskId: null,
      phase: "focus",
    }));
    const res = await batch({ credits });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION");
  });

  it("401s without a token", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/sync/batch", payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("reports a broken ledger per item instead of rejecting the body", async () => {
    repos.setFailure("ledger", true);
    const res = await batch({ tasks: [{ title: "still works" }] });
    expect(res.statusCode).toBe(200);
    expect(res.json().tasks[0].ok).toBe(true);
    expect(res.json().totalFocusedMs).toBeNull();
  });
});
