import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRepos } from "../src/repos/memory.js";

let repos;
let userId;

beforeEach(async () => {
  repos = createMemoryRepos();
  ({ userId } = await repos.users.createSession({
    deviceId: "device-1",
    tokenHash: "hash-1",
    now: 1000,
  }));
});

describe("users repo", () => {
  it("returns the same user for a repeat deviceId", async () => {
    const again = await repos.users.createSession({
      deviceId: "device-1",
      tokenHash: "hash-2",
      now: 2000,
    });
    expect(again.userId).toBe(userId);
  });

  it("rotates the token so only the newest hash resolves", async () => {
    await repos.users.createSession({ deviceId: "device-1", tokenHash: "hash-2", now: 2000 });
    expect(await repos.users.findByTokenHash("hash-1")).toBeNull();
    expect(await repos.users.findByTokenHash("hash-2")).toMatchObject({ id: userId });
  });

  it("defaults tabGuardEnabled to true and round-trips a change", async () => {
    expect(await repos.users.getSettings(userId)).toEqual({ tabGuardEnabled: true });
    expect(await repos.users.updateSettings(userId, { tabGuardEnabled: false })).toEqual({
      tabGuardEnabled: false,
    });
    expect(await repos.users.getSettings(userId)).toEqual({ tabGuardEnabled: false });
  });
});

describe("tasks repo", () => {
  it("creates newest-first and scopes to the user", async () => {
    await repos.tasks.create(userId, { title: "first", now: 1 });
    const second = await repos.tasks.create(userId, { title: "second", now: 2 });
    const list = await repos.tasks.list(userId);
    expect(list.map((t) => t.title)).toEqual(["second", "first"]);
    expect(list[0]).toMatchObject({
      id: second.id,
      done: false,
      active: false,
      focusedMs: 0,
      createdAt: 2,
    });

    const other = await repos.users.createSession({
      deviceId: "device-2",
      tokenHash: "hash-9",
      now: 3,
    });
    expect(await repos.tasks.list(other.userId)).toEqual([]);
  });

  it("keeps exactly one active task", async () => {
    const a = await repos.tasks.create(userId, { title: "a", now: 1 });
    const b = await repos.tasks.create(userId, { title: "b", now: 2 });
    await repos.tasks.patch(userId, a.id, { active: true });
    await repos.tasks.patch(userId, b.id, { active: true });
    const list = await repos.tasks.list(userId);
    expect(list.filter((t) => t.active).map((t) => t.id)).toEqual([b.id]);
  });

  it("accumulates focus on one task only", async () => {
    const a = await repos.tasks.create(userId, { title: "a", now: 1 });
    const b = await repos.tasks.create(userId, { title: "b", now: 2 });
    await repos.tasks.addFocus(userId, a.id, 1500);
    await repos.tasks.addFocus(userId, a.id, 500);
    const list = await repos.tasks.list(userId);
    expect(list.find((t) => t.id === a.id).focusedMs).toBe(2000);
    expect(list.find((t) => t.id === b.id).focusedMs).toBe(0);
  });

  it("reports removal of an unknown id as false", async () => {
    expect(await repos.tasks.remove(userId, "nope")).toBe(false);
  });
});

describe("ledger repo", () => {
  const credit = (over = {}) => ({
    userId,
    idempotencyKey: `${userId}:5000`,
    bodyHash: "hash-a",
    startedAt: 5000,
    endedAt: 5000 + 60_000,
    taskId: null,
    focusedMs: 60_000,
    now: 9999,
    ...over,
  });

  it("inserts once and sums", async () => {
    expect(await repos.ledger.insertCredit(credit())).toMatchObject({
      inserted: true,
      focusedMs: 60_000,
    });
    expect(await repos.ledger.totalFocusedMs(userId)).toBe(60_000);
  });

  it("refuses a duplicate key and reports what is stored", async () => {
    await repos.ledger.insertCredit(credit());
    const dup = await repos.ledger.insertCredit(credit({ focusedMs: 999, bodyHash: "hash-b" }));
    expect(dup).toEqual({ inserted: false, focusedMs: 60_000, bodyHash: "hash-a" });
    expect(await repos.ledger.totalFocusedMs(userId)).toBe(60_000);
  });

  it("sums many credits and starts a fresh user at zero", async () => {
    await repos.ledger.insertCredit(credit());
    await repos.ledger.insertCredit(credit({ idempotencyKey: `${userId}:6000`, startedAt: 6000 }));
    expect(await repos.ledger.totalFocusedMs(userId)).toBe(120_000);
    expect(await repos.ledger.totalFocusedMs("ghost")).toBe(0);
  });
});

describe("setFailure — the 503 switch every module test uses", () => {
  it("makes every method of one repo throw, leaving the others working", async () => {
    repos.setFailure("tasks", true);
    await expect(repos.tasks.list(userId)).rejects.toThrow(/tasks/);
    await expect(repos.tasks.probe()).rejects.toThrow(/tasks/);
    await expect(repos.users.getSettings(userId)).resolves.toBeTruthy();

    repos.setFailure("tasks", false);
    await expect(repos.tasks.list(userId)).resolves.toEqual([]);
  });
});
