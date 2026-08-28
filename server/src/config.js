import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS } from "hatch-core";

const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://romeo-04.github.io",
];

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};

const list = (value, fallback) =>
  value
    ? value.split(",").map((s) => s.trim()).filter(Boolean)
    : fallback;

/** Read the whole environment surface once, at boot, into a frozen object. */
export function loadConfig(env = process.env) {
  return Object.freeze({
    port: int(env.PORT, 8787),
    host: env.HOST ?? "0.0.0.0",
    databaseUrl: env.DATABASE_URL?.trim() || null,
    corsOrigins: list(env.CORS_ORIGINS, DEFAULT_ORIGINS),
    timeoutMs: int(env.TIMEOUT_MS, 3000),
    plannedFocusMs: int(env.PLANNED_FOCUS_MS, DEFAULT_SETTINGS.focusMs),
    petAssetBaseUrl: (env.PET_ASSET_BASE_URL ?? "").replace(/\/$/, ""),
    petAssetDir:
      env.PET_ASSET_DIR ?? fileURLToPath(new URL("../../public/pets", import.meta.url)),
    logLevel: env.LOG_LEVEL ?? "info",
    migrateOnBoot: env.MIGRATE_ON_BOOT === "true",
    rateLimitMax: int(env.RATE_LIMIT_MAX, 60),
  });
}
