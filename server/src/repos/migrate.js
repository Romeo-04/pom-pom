import { readFile } from "node:fs/promises";
import { loadConfig } from "../config.js";
import { createPool } from "./pg/pool.js";

const schemaPath = new URL("./schema.sql", import.meta.url);

export async function migrate(config) {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is not set — nothing to migrate");
  }
  const pool = createPool(config);
  try {
    await pool.query(await readFile(schemaPath, "utf8"));
  } finally {
    await pool.end();
  }
}

// `npm run migrate --workspace hatch-server`
if (import.meta.url === `file://${process.argv[1]}`) {
  await migrate(loadConfig());
  console.log("schema applied");
}
