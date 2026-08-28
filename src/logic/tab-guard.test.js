import { describe, expect, it } from "vitest";
import { PHASE } from "./pomodoro.js";
import { shouldAlertOnLeave, shouldFireAgain } from "./tab-guard.js";

describe("shouldAlertOnLeave", () => {
  it("alerts only during focus when the tab is hidden and the guard is on", () => {
    expect(
      shouldAlertOnLeave({ phase: PHASE.FOCUS, tabHidden: true, enabled: true }),
    ).toBe(true);
  });

  it("does not alert on breaks or idle", () => {
    expect(
      shouldAlertOnLeave({ phase: PHASE.SHORT_BREAK, tabHidden: true, enabled: true }),
    ).toBe(false);
    expect(
      shouldAlertOnLeave({ phase: PHASE.IDLE, tabHidden: true, enabled: true }),
    ).toBe(false);
  });

  it("does not alert while the tab is visible or the guard is off", () => {
    expect(
      shouldAlertOnLeave({ phase: PHASE.FOCUS, tabHidden: false, enabled: true }),
    ).toBe(false);
    expect(
      shouldAlertOnLeave({ phase: PHASE.FOCUS, tabHidden: true, enabled: false }),
    ).toBe(false);
  });
});

describe("shouldFireAgain", () => {
  it("blocks repeats inside the cooldown", () => {
    expect(shouldFireAgain(1_000, 4_000, 8_000)).toBe(false);
    expect(shouldFireAgain(1_000, 10_000, 8_000)).toBe(true);
    expect(shouldFireAgain(0, 1, 8_000)).toBe(true);
  });
});
