import { describe, expect, it } from "vitest";
import {
  hoursFromMs,
  nextStage,
  progressToNext,
  stageForHours,
  STAGES,
} from "./evolution.js";
import { creditFocusMs, nextPhaseAfter, PHASE } from "./pomodoro.js";

describe("stageForHours", () => {
  it("starts as egg", () => {
    expect(stageForHours(0).id).toBe("egg");
    expect(stageForHours(1.99).id).toBe("egg");
  });

  it("crosses each threshold inclusively", () => {
    expect(stageForHours(2).id).toBe("hatchling");
    expect(stageForHours(8).id).toBe("juvenile");
    expect(stageForHours(20).id).toBe("fledgling");
    expect(stageForHours(45).id).toBe("adult");
    expect(stageForHours(80).id).toBe("mythic");
    expect(stageForHours(200).id).toBe("mythic");
  });
});

describe("progressToNext", () => {
  it("is 0% just after a threshold", () => {
    const p = progressToNext(2);
    expect(p.current.id).toBe("hatchling");
    expect(p.next.id).toBe("juvenile");
    expect(p.ratio).toBe(0);
  });

  it("is full at mythic", () => {
    const p = progressToNext(80);
    expect(p.next).toBeNull();
    expect(p.ratio).toBe(1);
  });
});

describe("hoursFromMs", () => {
  it("converts a 25-minute pomo", () => {
    expect(hoursFromMs(25 * 60 * 1000)).toBeCloseTo(25 / 60);
  });
});

describe("pomodoro cycle", () => {
  it("takes a long break every 4 focuses", () => {
    expect(nextPhaseAfter(PHASE.FOCUS, 3)).toBe(PHASE.LONG_BREAK);
    expect(nextPhaseAfter(PHASE.FOCUS, 0)).toBe(PHASE.SHORT_BREAK);
    expect(nextPhaseAfter(PHASE.SHORT_BREAK, 1)).toBe(PHASE.FOCUS);
  });

  it("caps credited time at the planned duration", () => {
    const start = 1_000_000;
    expect(creditFocusMs(start, 25_000, start + 40_000)).toBe(25_000);
  });
});

describe("STAGES contract", () => {
  it("matches the Gemini document thresholds", () => {
    expect(STAGES.map((s) => [s.id, s.hours])).toEqual([
      ["egg", 0],
      ["hatchling", 2],
      ["juvenile", 8],
      ["fledgling", 20],
      ["adult", 45],
      ["mythic", 80],
    ]);
  });
});
