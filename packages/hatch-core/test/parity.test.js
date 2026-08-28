import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { creditFocusMs, DEFAULT_SETTINGS, stageForMs, STAGES } from "../index.js";

const clientEvolution = fileURLToPath(
  new URL("../../../src/logic/evolution.js", import.meta.url),
);
const clientPomodoro = fileURLToPath(
  new URL("../../../src/logic/pomodoro.js", import.meta.url),
);

describe("hatch-core exports the frozen contract", () => {
  it("has the six stage ids from docs/gemini-pet-assets.md", () => {
    expect(STAGES.map((s) => [s.id, s.hours])).toEqual([
      ["egg", 0],
      ["hatchling", 2],
      ["juvenile", 8],
      ["fledgling", 20],
      ["adult", 45],
      ["mythic", 80],
    ]);
  });

  it("maps focused milliseconds to a stage id", () => {
    expect(stageForMs(0).id).toBe("egg");
    expect(stageForMs(2 * 60 * 60 * 1000).id).toBe("hatchling");
    expect(stageForMs(80 * 60 * 60 * 1000).id).toBe("mythic");
  });

  it("caps a credit at the planned duration", () => {
    const start = 1_000_000;
    expect(creditFocusMs(start, 25_000, start + 40_000)).toBe(25_000);
    expect(creditFocusMs(start, 25_000, start + 10_000)).toBe(10_000);
    expect(creditFocusMs(start, 25_000, start - 5_000)).toBe(0);
  });

  it("defaults a focus phase to 25 minutes", () => {
    expect(DEFAULT_SETTINGS.focusMs).toBe(25 * 60 * 1000);
  });
});

// These skip themselves once FE-0 lands and src/logic/* re-exports from the package.
describe("copy has not drifted from the client kernel", () => {
  it.skipIf(!existsSync(clientEvolution))("shares one STAGES table", async () => {
    const client = await import(clientEvolution);
    expect(client.STAGES).toEqual(STAGES);
  });

  it.skipIf(!existsSync(clientPomodoro))("shares one credit rule", async () => {
    const client = await import(clientPomodoro);
    const start = 5_000;
    for (const now of [start, start + 1, start + 12_345, start + 999_999]) {
      expect(client.creditFocusMs(start, 25_000, now)).toBe(
        creditFocusMs(start, 25_000, now),
      );
    }
    expect(client.DEFAULT_SETTINGS).toEqual(DEFAULT_SETTINGS);
  });
});
