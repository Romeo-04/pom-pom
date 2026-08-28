import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createHealth } from "../src/lib/module-health.js";
import { createMemoryRepos } from "../src/repos/memory.js";
import { createPgRepos, probeAll } from "../src/repos/pg/index.js";
import { createPool } from "../src/repos/pg/pool.js";

/**
 * Vercel serverless entry point. No app.listen() here — a serverless function has no
 * socket to bind. Instead Fastify's own http.Server instance is fed the (req, res) pair
 * it would otherwise have gotten from listen(), which is the pattern Fastify's own
 * serverless guide documents.
 *
 * The app is built once per warm lambda instance (module-level singleton) and reused
 * across invocations. Unlike the long-lived server (src/index.js), a serverless
 * instance has no guarantee it survives to serve a second request, so probeAll is
 * awaited here rather than fire-and-forget — otherwise /health would report
 * "degraded" on every cold start even with a working DATABASE_URL, because the
 * probe would still be in flight when the response went out.
 */
let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const config = loadConfig();
      const health = createHealth("degraded");

      let repos = createMemoryRepos();
      if (config.databaseUrl) {
        const pool = createPool(config);
        repos = createPgRepos(pool);
        await probeAll({ repos, health }).catch(() => {});
      }

      const app = await buildApp({ config, repos, health });
      await app.ready();
      return app;
    })();
  }
  return appPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  app.server.emit("request", req, res);
}
