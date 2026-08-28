import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createHealth } from "../src/lib/module-health.js";
import { createMemoryRepos } from "../src/repos/memory.js";

const makeApp = async (health = createHealth("up")) =>
  buildApp({ config: loadConfig({}), repos: createMemoryRepos(), health, logger: false });

describe("GET /health (BE-0)", () => {
  it("reports every module at both paths", async () => {
    const app = await makeApp();
    for (const url of ["/health", "/api/v1/health"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        ok: true,
        modules: { identity: "up", tasks: "up", ledger: "up", pets: "up" },
      });
    }
    await app.close();
  });

  it("still returns 200 when every module is down", async () => {
    const health = createHealth("down");
    const app = await makeApp(health);
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().modules).toEqual({
      identity: "down",
      tasks: "down",
      ledger: "down",
      pets: "down",
    });
    await app.close();
  });

  it("404s an unknown route in the error envelope without touching /health", async () => {
    const app = await makeApp();
    const missing = await app.inject({ method: "GET", url: "/api/v1/nope" });
    expect(missing.statusCode).toBe(404);
    const still = await app.inject({ method: "GET", url: "/health" });
    expect(still.statusCode).toBe(200);
    await app.close();
  });
});

describe("observability (BE-7)", () => {
  it("echoes an inbound x-request-id", async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "abc-123" },
    });
    expect(res.headers["x-request-id"]).toBe("abc-123");
    await app.close();
  });

  it("generates a request id when the client sends none", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-request-id"]).toMatch(/.+/);
    await app.close();
  });
});

describe("CORS", () => {
  it("allows the Vite dev origin", async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/health",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "GET",
      },
    });
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    await app.close();
  });

  it("does not echo an unlisted origin", async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { origin: "https://evil.example" },
    });
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });
});
