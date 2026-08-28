import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STAGES } from "hatch-core";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createHealth } from "../src/lib/module-health.js";
import { createMemoryRepos } from "../src/repos/memory.js";

const makeApp = (env) =>
  buildApp({
    config: loadConfig(env),
    repos: createMemoryRepos(),
    health: createHealth("up"),
    logger: false,
  });

describe("GET /pets/manifest (BE-4)", () => {
  it("lists every stage even with no PNGs on disk", async () => {
    const app = await makeApp({ PET_ASSET_DIR: join(tmpdir(), "definitely-not-here") });
    const res = await app.inject({ method: "GET", url: "/api/v1/pets/manifest" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe(1);
    expect(body.stages.map((s) => s.id)).toEqual(STAGES.map((s) => s.id));
    for (const stage of body.stages) {
      expect(stage.fallback).toBe("placeholder");
      expect(stage.url).toContain("placeholders");
    }
    await app.close();
  });

  it("points at the real file when it exists and prefixes the CDN base", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hatch-pets-"));
    writeFileSync(join(dir, "inklet-egg.png"), "not-really-a-png");
    const app = await makeApp({
      PET_ASSET_DIR: dir,
      PET_ASSET_BASE_URL: "https://cdn.example.com/",
    });
    const body = (await app.inject({ method: "GET", url: "/api/v1/pets/manifest" })).json();
    const egg = body.stages.find((s) => s.id === "egg");
    expect(egg).toEqual({
      id: "egg",
      url: "https://cdn.example.com/pets/inklet-egg.png",
      fallback: null,
    });
    expect(body.stages.find((s) => s.id === "mythic").fallback).toBe("placeholder");
    await app.close();
  });

  it("needs no token — the pet well must render before login", async () => {
    const app = await makeApp({});
    expect((await app.inject({ method: "GET", url: "/api/v1/pets/manifest" })).statusCode).toBe(200);
    await app.close();
  });
});
