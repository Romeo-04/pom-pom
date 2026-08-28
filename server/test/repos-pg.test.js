import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { migrate } from "../src/repos/migrate.js";
import { createPgRepos } from "../src/repos/pg/index.js";
import { createPool } from "../src/repos/pg/pool.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const config = loadConfig();

let pool;
let repos;
let userId;

beforeAll(async () => {
  if (!hasDb) return;
  await migrate(config);
  pool = createPool(config);
  repos = createPgRepos(pool);
  ({ userId } = await repos.users.createSession({
    deviceId: `test-${Date.now()}-${Math.random()}`,
    tokenHash: `hash-${Date.now()}`,
    now: Date.now(),
  }));
});

afterAll(async () => {
  if (!hasDb || !pool) return;
  await pool.query("DELETE FROM users WHERE id = $1", [userId]); // cascades
  await pool.end();
});

describe.skipIf(!hasDb)("pg repos satisfy the same port as memory", () => {
  it("round-trips a token and rotates it on the next session", async () => {
    const deviceId = `dev-${userId}`;
    const first = `hash-first-${Date.now()}`;
    const second = `hash-second-${Date.now()}`;

    const created = await repos.users.createSession({ deviceId, tokenHash: first, now: Date.now() });
    expect(await repos.users.findByTokenHash(first)).toMatchObject({ id: created.userId });

    const again = await repos.users.createSession({ deviceId, tokenHash: second, now: Date.now() });
    expect(again.userId).toBe(created.userId);
    expect(await repos.users.findByTokenHash(first)).toBeNull();
    expect(await repos.users.findByTokenHash(second)).toMatchObject({ id: created.userId });

    await pool.query("DELETE FROM users WHERE id = $1", [created.userId]);
  });

  it("returns focusedMs as a number, not a bigint string", async () => {
    const task = await repos.tasks.create(userId, { title: "pg task", now: Date.now() });
    await repos.tasks.addFocus(userId, task.id, 1500);
    const [row] = await repos.tasks.list(userId);
    expect(row.focusedMs).toBe(1500);
    expect(typeof row.focusedMs).toBe("number");
    expect(typeof row.createdAt).toBe("number");
  });

  it("enforces idempotency at the unique constraint", async () => {
    const base = {
      userId,
      idempotencyKey: `${userId}:${Date.now()}`,
      bodyHash: "hash-a",
      startedAt: Date.now(),
      endedAt: Date.now() + 60_000,
      taskId: null,
      focusedMs: 60_000,
      now: Date.now(),
    };
    expect(await repos.ledger.insertCredit(base)).toMatchObject({ inserted: true });
    const dup = await repos.ledger.insertCredit({ ...base, focusedMs: 1, bodyHash: "hash-b" });
    expect(dup).toEqual({ inserted: false, focusedMs: 60_000, bodyHash: "hash-a" });
  });

  it("sums totals as a number", async () => {
    const total = await repos.ledger.totalFocusedMs(userId);
    expect(typeof total).toBe("number");
    expect(total).toBeGreaterThanOrEqual(60_000);
  });
});
