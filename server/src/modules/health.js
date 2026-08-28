/**
 * BE-0. The only route that must never fail. It reads an in-memory registry —
 * no database call — so it answers 200 while every other module is on fire.
 */
export default async function healthModule(app) {
  const handler = async (request) => ({
    ok: true,
    modules: app.health.snapshot(),
    requestId: request.id,
    version: process.env.APP_VERSION ?? "dev",
  });

  app.get("/health", handler);
  app.get("/api/v1/health", handler);
}
