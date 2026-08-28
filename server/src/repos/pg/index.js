import { validation } from "../../lib/errors.js";

const taskRow = (row) => ({
  id: row.id,
  title: row.title,
  done: row.done,
  active: row.active,
  focusedMs: row.focused_ms,
  createdAt: row.created_at,
});

/** Postgres implementation of the repository port defined in server/src/repos/memory.js. */
export function createPgRepos(pool) {
  return {
    kind: "pg",

    users: {
      probe: () => pool.probe("users"),

      async createSession({ deviceId, tokenHash, now }) {
        const { rows } = await pool.query(
          `INSERT INTO users (device_id, token_hash, created_at)
                VALUES ($1, $2, $3)
           ON CONFLICT (device_id)
           DO UPDATE SET token_hash = EXCLUDED.token_hash
             RETURNING id, created_at`,
          [deviceId, tokenHash, now],
        );
        return { userId: rows[0].id, createdAt: rows[0].created_at };
      },

      async findByTokenHash(tokenHash) {
        const { rows } = await pool.query(
          "SELECT id, tab_guard_enabled FROM users WHERE token_hash = $1",
          [tokenHash],
        );
        if (rows.length === 0) return null;
        return { id: rows[0].id, tabGuardEnabled: rows[0].tab_guard_enabled };
      },

      async getSettings(userId) {
        const { rows } = await pool.query(
          "SELECT tab_guard_enabled FROM users WHERE id = $1",
          [userId],
        );
        return { tabGuardEnabled: rows.length ? rows[0].tab_guard_enabled : true };
      },

      async updateSettings(userId, { tabGuardEnabled }) {
        const { rows } = await pool.query(
          `UPDATE users SET tab_guard_enabled = $2 WHERE id = $1
             RETURNING tab_guard_enabled`,
          [userId, Boolean(tabGuardEnabled)],
        );
        if (rows.length === 0) throw validation("identity", "unknown user");
        return { tabGuardEnabled: rows[0].tab_guard_enabled };
      },
    },

    tasks: {
      probe: () => pool.probe("tasks"),

      async list(userId) {
        const { rows } = await pool.query(
          `SELECT id, title, done, active, focused_ms, created_at
             FROM tasks WHERE user_id = $1 ORDER BY created_at DESC`,
          [userId],
        );
        return rows.map(taskRow);
      },

      async create(userId, { title, now }) {
        const { rows } = await pool.query(
          `INSERT INTO tasks (user_id, title, created_at) VALUES ($1, $2, $3)
             RETURNING id, title, done, active, focused_ms, created_at`,
          [userId, title, now],
        );
        return taskRow(rows[0]);
      },

      async patch(userId, id, patch) {
        // "active" is exclusive per user, so clearing the others and setting this one
        // must be one statement pair the reader cannot observe half of.
        if (patch.active === true) {
          await pool.query(
            "UPDATE tasks SET active = FALSE WHERE user_id = $1 AND active = TRUE",
            [userId],
          );
        }
        const { rows } = await pool.query(
          `UPDATE tasks
              SET done   = COALESCE($3, done),
                  active = COALESCE($4, active)
            WHERE id = $1 AND user_id = $2
        RETURNING id, title, done, active, focused_ms, created_at`,
          [id, userId, patch.done ?? null, patch.active ?? null],
        );
        if (rows.length === 0) throw validation("tasks", "unknown task id");
        return taskRow(rows[0]);
      },

      async remove(userId, id) {
        const { rowCount } = await pool.query(
          "DELETE FROM tasks WHERE id = $1 AND user_id = $2",
          [id, userId],
        );
        return rowCount > 0;
      },

      async addFocus(userId, taskId, ms) {
        await pool.query(
          "UPDATE tasks SET focused_ms = focused_ms + $3 WHERE id = $1 AND user_id = $2",
          [taskId, userId, ms],
        );
      },
    },

    ledger: {
      probe: () => pool.probe("focus_credits"),

      async insertCredit({
        userId,
        idempotencyKey,
        bodyHash,
        startedAt,
        endedAt,
        taskId,
        focusedMs,
        now,
      }) {
        const inserted = await pool.query(
          `INSERT INTO focus_credits
             (user_id, idempotency_key, body_hash, started_at, ended_at, task_id, focused_ms, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (user_id, idempotency_key) DO NOTHING
             RETURNING focused_ms, body_hash`,
          [userId, idempotencyKey, bodyHash, startedAt, endedAt, taskId, focusedMs, now],
        );
        if (inserted.rows.length > 0) {
          return { inserted: true, focusedMs: inserted.rows[0].focused_ms, bodyHash };
        }
        const existing = await pool.query(
          `SELECT focused_ms, body_hash FROM focus_credits
            WHERE user_id = $1 AND idempotency_key = $2`,
          [userId, idempotencyKey],
        );
        return {
          inserted: false,
          focusedMs: existing.rows[0].focused_ms,
          bodyHash: existing.rows[0].body_hash,
        };
      },

      async totalFocusedMs(userId) {
        const { rows } = await pool.query(
          "SELECT COALESCE(SUM(focused_ms), 0)::bigint AS total FROM focus_credits WHERE user_id = $1",
          [userId],
        );
        return rows[0].total;
      },
    },
  };
}

/**
 * Boot probe. Each module gets its own try/catch: a missing `tasks` table must leave
 * identity and ledger "up" (spec §6 BE-1/BE-2 "do not fail the whole process").
 */
export async function probeAll({ repos, health, log }) {
  const checks = [
    ["identity", repos.users],
    ["tasks", repos.tasks],
    ["ledger", repos.ledger],
  ];
  for (const [module, repo] of checks) {
    try {
      await repo.probe();
      health.markUp(module);
    } catch (error) {
      health.markDown(module);
      log?.error({ module, err: error.message }, "module probe failed at boot");
    }
  }
}
