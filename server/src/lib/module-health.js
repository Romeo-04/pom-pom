/** The modules the client polls in GET /health (spec §3.1). */
export const MODULES = Object.freeze(["identity", "tasks", "ledger", "pets"]);

/**
 * Per-module status, held in memory for the life of the process.
 * "up"       route works and persists
 * "degraded" route works, persistence is partial or in-memory
 * "down"     route returns 503; the client falls back to its Memory adapter
 */
export function createHealth(initial = "down") {
  const state = new Map(MODULES.map((m) => [m, initial]));
  const set = (module, status) => {
    if (state.has(module)) state.set(module, status);
  };
  return {
    snapshot: () => Object.fromEntries(state),
    get: (module) => state.get(module) ?? "down",
    set,
    markUp: (module) => set(module, "up"),
    markDegraded: (module) => set(module, "degraded"),
    markDown: (module) => set(module, "down"),
    isUsable: (module) => state.get(module) !== "down",
  };
}
