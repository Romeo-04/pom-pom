import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { AppError, CODES } from "./lib/errors.js";
import healthModule from "./modules/health.js";
import identityModule from "./modules/identity.js";
import tasksModule from "./modules/tasks.js";
import ledgerModule from "./modules/ledger.js";
import petsModule from "./modules/pets.js";
import settingsModule from "./modules/settings.js";
import syncModule from "./modules/sync.js";

/**
 * Wire an app from already-constructed collaborators. Opens no sockets, connects to
 * no database — that is src/index.js's job. Tests build one per case and inject().
 */
export async function buildApp({ config, repos, health, logger }) {
  const app = Fastify({
    logger: logger ?? { level: config.logLevel },
    requestTimeout: config.timeoutMs,
    disableRequestLogging: false,
    genReqId: (req) => req.headers["x-request-id"] ?? randomUUID(),
  });

  app.decorate("config", config);
  app.decorate("repos", repos);
  app.decorate("health", health);

  // BE-7: the request id goes out on every response, success or failure.
  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
    const module = request.routeOptions?.config?.module;
    if (module && reply.statusCode >= 400) {
      request.log.warn(
        { module, statusCode: reply.statusCode, requestId: request.id },
        "request failed",
      );
    }
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type", "authorization", "x-request-id"],
    maxAge: 86400,
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      // BE-7: a 503 is a module-level event and always gets a log line.
      if (error.statusCode === 503) {
        request.log.error(
          { module: error.module, code: error.code, requestId: request.id },
          "module unavailable",
        );
      }
      return reply.code(error.statusCode).send(error.toEnvelope());
    }
    if (error.validation) {
      return reply.code(400).send({
        error: {
          code: CODES.VALIDATION,
          message: error.message,
          module: request.routeOptions?.config?.module ?? "unknown",
        },
      });
    }
    request.log.error({ err: error, requestId: request.id }, "unhandled error");
    return reply.code(500).send({
      error: { code: "INTERNAL", message: "unexpected error", module: "unknown" },
    });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: { code: "NOT_FOUND", message: `no route for ${request.url}`, module: "unknown" },
    }),
  );

  await app.register(healthModule);

  // One register() per module, each in its own try/catch: a module that fails to load
  // must not stop the others from serving (spec §6 "process isolation").
  for (const [name, plugin] of [
    ["identity", identityModule],
    ["tasks", tasksModule],
    ["ledger", ledgerModule],
    ["pets", petsModule],
    ["identity", settingsModule],
    ["ledger", syncModule],
  ]) {
    try {
      await app.register(plugin, { prefix: "/api/v1" });
    } catch (error) {
      health.markDown(name);
      app.log.error({ module: name, err: error.message }, "module failed to register");
    }
  }

  return app;
}
