import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createHealth } from "./lib/module-health.js";
import { createMemoryRepos } from "./repos/memory.js";
import { migrate } from "./repos/migrate.js";
import { createPgRepos, probeAll } from "./repos/pg/index.js";
import { createPool } from "./repos/pg/pool.js";

const config = loadConfig();
const health = createHealth("degraded");

let repos = createMemoryRepos();
let pool = null;

if (config.databaseUrl) {
  pool = createPool(config);
  repos = createPgRepos(pool);
}

const app = await buildApp({ config, repos, health });

if (config.databaseUrl) {
  if (config.migrateOnBoot) {
    try {
      await migrate(config);
    } catch (error) {
      app.log.error({ err: error.message }, "migrate on boot failed; continuing");
    }
  }
  // Boot probing must never block listen(): a database that is asleep should
  // produce a "down" flag, not a container that fails its healthcheck.
  probeAll({ repos, health, log: app.log }).catch(() => {});
} else {
  app.log.warn("DATABASE_URL not set — running on in-memory repos, nothing persists");
}

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error, "failed to listen");
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await app.close();
    await pool?.end();
    process.exit(0);
  });
}
