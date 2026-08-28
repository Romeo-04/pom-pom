import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { guard } from "../lib/guard.js";

const require = createRequire(import.meta.url);
const catalog = require("../pets/manifest.json");

const MODULE = "pets";

/**
 * BE-4. Static catalog, no database. A missing PNG is a normal answer, not an error:
 * the client gets the placeholder URL and the pet well never blanks (spec §6 BE-4).
 */
export default async function petsModule(app) {
  app.get("/pets/manifest", { config: { module: MODULE } }, async () =>
    guard(MODULE, app.health, async () => {
      const base = app.config.petAssetBaseUrl;
      const stages = catalog.stages.map((stage) => {
        const present = existsSync(join(app.config.petAssetDir, stage.file));
        const path = present ? `pets/${stage.file}` : stage.placeholder;
        return {
          id: stage.id,
          url: base ? `${base}/${path}` : `/${path}`,
          fallback: present ? null : "placeholder",
        };
      });
      return { version: catalog.version, stages };
    }),
  );
}
