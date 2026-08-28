import { randomUUID } from "node:crypto";
import { validation } from "../lib/errors.js";

/**
 * In-memory implementation of the repository port.
 *
 * Two jobs:
 *  1. Tests inject it, so every route test runs with no Postgres.
 *  2. Running the server with no DATABASE_URL still serves the whole contract,
 *     reporting "degraded" in /health. A frontend dev can develop against the
 *     real routes with zero infrastructure.
 *
 * setFailure(module, true) makes that repo throw on every call, which is how the
 * 503-path test required by spec §8.3 is written.
 */
export function createMemoryRepos() {
  const users = new Map(); // userId -> { id, deviceId, tokenHash, tabGuardEnabled, createdAt }
  const byDevice = new Map(); // deviceId -> userId
  const tasks = new Map(); // taskId -> Task & { userId }
  const credits = new Map(); // `${userId} ${key}` -> { focusedMs, bodyHash }
  const failing = new Set();

  const check = (module) => {
    if (failing.has(module)) throw new Error(`${module} storage unavailable (simulated)`);
  };

  const publicTask = ({ userId: _userId, ...task }) => ({ ...task });

  return {
    kind: "memory",

    setFailure(module, on) {
      if (on) failing.add(module);
      else failing.delete(module);
    },

    users: {
      async probe() {
        check("identity");
      },
      async createSession({ deviceId, tokenHash, now }) {
        check("identity");
        const existingId = byDevice.get(deviceId);
        if (existingId) {
          const user = users.get(existingId);
          user.tokenHash = tokenHash;
          return { userId: user.id, createdAt: user.createdAt };
        }
        const user = {
          id: randomUUID(),
          deviceId,
          tokenHash,
          tabGuardEnabled: true,
          createdAt: now,
        };
        users.set(user.id, user);
        byDevice.set(deviceId, user.id);
        return { userId: user.id, createdAt: user.createdAt };
      },
      async findByTokenHash(tokenHash) {
        check("identity");
        for (const user of users.values()) {
          if (user.tokenHash === tokenHash) {
            return { id: user.id, tabGuardEnabled: user.tabGuardEnabled };
          }
        }
        return null;
      },
      async getSettings(userId) {
        check("identity");
        const user = users.get(userId);
        return { tabGuardEnabled: user ? user.tabGuardEnabled : true };
      },
      async updateSettings(userId, { tabGuardEnabled }) {
        check("identity");
        const user = users.get(userId);
        if (!user) throw validation("identity", "unknown user");
        user.tabGuardEnabled = Boolean(tabGuardEnabled);
        return { tabGuardEnabled: user.tabGuardEnabled };
      },
    },

    tasks: {
      async probe() {
        check("tasks");
      },
      async list(userId) {
        check("tasks");
        return [...tasks.values()]
          .filter((t) => t.userId === userId)
          .sort((a, b) => b.createdAt - a.createdAt)
          .map(publicTask);
      },
      async create(userId, { title, now }) {
        check("tasks");
        const task = {
          id: randomUUID(),
          userId,
          title,
          done: false,
          active: false,
          focusedMs: 0,
          createdAt: now,
        };
        tasks.set(task.id, task);
        return publicTask(task);
      },
      async patch(userId, id, patch) {
        check("tasks");
        const task = tasks.get(id);
        if (!task || task.userId !== userId) throw validation("tasks", "unknown task id");
        if (patch.done !== undefined) task.done = Boolean(patch.done);
        if (patch.active !== undefined) {
          const active = Boolean(patch.active);
          if (active) {
            for (const other of tasks.values()) {
              if (other.userId === userId) other.active = false;
            }
          }
          task.active = active;
        }
        return publicTask(task);
      },
      async remove(userId, id) {
        check("tasks");
        const task = tasks.get(id);
        if (!task || task.userId !== userId) return false;
        tasks.delete(id);
        return true;
      },
      async addFocus(userId, taskId, ms) {
        check("tasks");
        const task = tasks.get(taskId);
        if (!task || task.userId !== userId) return;
        task.focusedMs += ms;
      },
    },

    ledger: {
      async probe() {
        check("ledger");
      },
      async insertCredit({ userId, idempotencyKey, bodyHash, focusedMs }) {
        check("ledger");
        const key = `${userId} ${idempotencyKey}`;
        const existing = credits.get(key);
        if (existing) {
          return { inserted: false, focusedMs: existing.focusedMs, bodyHash: existing.bodyHash };
        }
        credits.set(key, { focusedMs, bodyHash, userId });
        return { inserted: true, focusedMs, bodyHash };
      },
      async totalFocusedMs(userId) {
        check("ledger");
        let total = 0;
        for (const credit of credits.values()) {
          if (credit.userId === userId) total += credit.focusedMs;
        }
        return total;
      },
    },
  };
}
