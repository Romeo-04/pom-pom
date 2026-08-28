import pg from "pg";
import { unavailable } from "../../lib/errors.js";

// BIGINT (int8) arrives as a string by default, which turns `a + b` into "6000060000".
// Every bigint here is a millisecond value, far below Number.MAX_SAFE_INTEGER.
pg.types.setTypeParser(20, (value) => (value === null ? null : Number(value)));

export function createPool(config) {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: config.timeoutMs,
    statement_timeout: config.timeoutMs,
    query_timeout: config.timeoutMs,
  });

  // A pool-level error (server restart, Supabase pausing) must not crash the process.
  pool.on("error", () => {});

  return {
    query: (text, params) => pool.query(text, params),
    /** Cheapest possible "does this module's table exist and answer" check. */
    async probe(table) {
      try {
        await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
      } catch (error) {
        throw unavailable("unknown", `probe ${table} failed: ${error.message}`);
      }
    },
    end: () => pool.end(),
  };
}
