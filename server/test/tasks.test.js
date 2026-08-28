import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createHealth } from "../src/lib/module-health.js";
import { createMemoryRepos } from "../src/repos/memory.js";

let app;
let repos;
let health;
let auth;

beforeEach(async () => {
  repos = createMemoryRepos();
  health = createHealth("up");
  app = await buildApp({ config: loadConfig({}), repos, health, logger: false });
  const session = (
    await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: { deviceId: "device-tasks-0001" },
    })
  ).json();
  auth = { authorization: `Bearer ${session.token}` };
});

const createTask = (title) =>
  app.inject({ method: "POST", url: "/api/v1/tasks", headers: auth, payload: { title } });

describe("tasks CRUD (BE-2)", () => {
  it("starts empty", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/tasks", headers: auth });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ tasks: [] });
  });

  it("creates a task in the contract shape", async () => {
    const res = await createTask("  read chapter 4  ");
    expect(res.statusCode).toBe(200);
    const task = res.json();
    expect(task).toMatchObject({
      title: "read chapter 4",
      done: false,
      active: false,
      focusedMs: 0,
    });
    expect(typeof task.id).toBe("string");
    expect(typeof task.createdAt).toBe("number");
  });

  it("rejects an empty title as VALIDATION", async () => {
    const res = await createTask("   ");
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatchObject({ code: "VALIDATION", module: "tasks" });
  });

  it("patches done and active", async () => {
    const task = (await createTask("essay")).json();
    const done = await app.inject({
      method: "PATCH",
      url: `/api/v1/tasks/${task.id}`,
      headers: auth,
      payload: { done: true },
    });
    expect(done.json()).toMatchObject({ id: task.id, done: true });

    const active = await app.inject({
      method: "PATCH",
      url: `/api/v1/tasks/${task.id}`,
      headers: auth,
      payload: { active: true },
    });
    expect(active.json()).toMatchObject({ active: true, done: true });
  });

  it("rejects a patch with no known field", async () => {
    const task = (await createTask("essay")).json();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/tasks/${task.id}`,
      headers: auth,
      payload: { colour: "blue" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.module).toBe("tasks");
  });

  it("deletes and reports an unknown id as VALIDATION", async () => {
    const task = (await createTask("essay")).json();
    const del = await app.inject({
      method: "DELETE",
      url: `/api/v1/tasks/${task.id}`,
      headers: auth,
    });
    expect(del.json()).toEqual({ ok: true });

    const again = await app.inject({
      method: "DELETE",
      url: `/api/v1/tasks/${task.id}`,
      headers: auth,
    });
    expect(again.statusCode).toBe(400);
  });

  it("never leaks another user's tasks", async () => {
    await createTask("mine");
    const other = (
      await app.inject({
        method: "POST",
        url: "/api/v1/sessions",
        payload: { deviceId: "device-tasks-0002" },
      })
    ).json();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/tasks",
      headers: { authorization: `Bearer ${other.token}` },
    });
    expect(res.json()).toEqual({ tasks: [] });
  });
});

describe("tasks 503 path (spec §8.3)", () => {
  it("returns the tasks envelope and leaves identity up", async () => {
    repos.setFailure("tasks", true);
    const res = await app.inject({ method: "GET", url: "/api/v1/tasks", headers: auth });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toMatchObject({ code: "UNAVAILABLE", module: "tasks" });

    const healthRes = await app.inject({ method: "GET", url: "/health" });
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.json().modules).toMatchObject({ tasks: "down", identity: "up" });
  });
});

describe("auth on tasks", () => {
  it("401s with no token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/tasks" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatchObject({ code: "UNAUTHORIZED", module: "identity" });
  });
});
