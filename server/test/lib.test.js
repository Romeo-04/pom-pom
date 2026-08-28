import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { AppError, CODES, conflict, unauthorized, unavailable, validation } from "../src/lib/errors.js";
import { createHealth, MODULES } from "../src/lib/module-health.js";
import { bestEffort, guard, withTimeout } from "../src/lib/guard.js";

describe("error envelope", () => {
  it("maps every contract code to its status", () => {
    expect(validation("tasks", "bad").statusCode).toBe(400);
    expect(unauthorized("identity").statusCode).toBe(401);
    expect(conflict("ledger", "dup").statusCode).toBe(409);
    expect(unavailable("pets").statusCode).toBe(503);
  });

  it("serialises to the shape in spec section 3.6", () => {
    expect(validation("tasks", "title is required").toEnvelope()).toEqual({
      error: { code: "VALIDATION", message: "title is required", module: "tasks" },
    });
  });

  it("keeps the four codes and nothing else", () => {
    expect(Object.keys(CODES).sort()).toEqual([
      "CONFLICT",
      "UNAUTHORIZED",
      "UNAVAILABLE",
      "VALIDATION",
    ]);
  });
});

describe("module health registry", () => {
  it("starts every module at the given status", () => {
    expect(createHealth("up").snapshot()).toEqual({
      identity: "up",
      tasks: "up",
      ledger: "up",
      pets: "up",
    });
    expect(MODULES).toEqual(["identity", "tasks", "ledger", "pets"]);
  });

  it("treats degraded as usable and down as not", () => {
    const health = createHealth("up");
    health.markDegraded("tasks");
    expect(health.isUsable("tasks")).toBe(true);
    health.markDown("tasks");
    expect(health.isUsable("tasks")).toBe(false);
    expect(health.isUsable("ledger")).toBe(true);
  });
});

describe("withTimeout", () => {
  it("resolves a fast promise untouched", async () => {
    await expect(withTimeout(Promise.resolve(7), 50, "tasks")).resolves.toBe(7);
  });

  it("rejects a slow promise as UNAVAILABLE for that module", async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 200));
    await expect(withTimeout(slow, 10, "tasks")).rejects.toMatchObject({
      code: "UNAVAILABLE",
      module: "tasks",
      statusCode: 503,
    });
  });
});

describe("guard", () => {
  it("marks the module up after a success", async () => {
    const health = createHealth("down");
    await expect(guard("tasks", health, async () => "ok")).resolves.toBe("ok");
    expect(health.get("tasks")).toBe("up");
  });

  it("marks the module down and converts an unknown throw to 503", async () => {
    const health = createHealth("up");
    await expect(
      guard("tasks", health, async () => {
        throw new Error('relation "tasks" does not exist');
      }),
    ).rejects.toMatchObject({ code: "UNAVAILABLE", module: "tasks" });
    expect(health.get("tasks")).toBe("down");
  });

  it("passes an AppError through without downing the module", async () => {
    const health = createHealth("up");
    await expect(
      guard("tasks", health, async () => {
        throw validation("tasks", "title is required");
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(health.get("tasks")).toBe("up");
  });
});

describe("bestEffort", () => {
  it("returns false instead of throwing when the other module is broken", async () => {
    const health = createHealth("up");
    const ok = await bestEffort("tasks", health, async () => {
      throw new Error("boom");
    });
    expect(ok).toBe(false);
    expect(health.get("tasks")).toBe("down");
  });

  it("returns true on success", async () => {
    const health = createHealth("up");
    expect(await bestEffort("tasks", health, async () => 1)).toBe(true);
  });
});

describe("loadConfig", () => {
  it("falls back to safe defaults with an empty environment", () => {
    const config = loadConfig({});
    expect(config.port).toBe(8787);
    expect(config.databaseUrl).toBeNull();
    expect(config.timeoutMs).toBe(3000);
    expect(config.plannedFocusMs).toBe(25 * 60 * 1000);
    expect(config.corsOrigins).toContain("http://localhost:5173");
  });

  it("splits and trims CORS origins", () => {
    expect(loadConfig({ CORS_ORIGINS: "https://a.dev , https://b.dev" }).corsOrigins).toEqual([
      "https://a.dev",
      "https://b.dev",
    ]);
  });

  it("is frozen so a module cannot mutate global config", () => {
    const config = loadConfig({});
    expect(Object.isFrozen(config)).toBe(true);
  });
});
