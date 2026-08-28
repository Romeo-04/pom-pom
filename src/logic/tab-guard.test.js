import { describe, expect, it } from "vitest";
import { shouldAlertOnLeave, shouldFireAgain } from "./tab-guard.js";

describe("shouldAlertOnLeave", () => {
  it("alerts when the tab is hidden and the guard is on", () => {
    expect(shouldAlertOnLeave({ tabHidden: true, enabled: true })).toBe(true);
  });

  it("does not alert while the tab is visible or the guard is off", () => {
    expect(
      shouldAlertOnLeave({ tabHidden: false, enabled: true }),
    ).toBe(false);
    expect(
      shouldAlertOnLeave({ tabHidden: true, enabled: false }),
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
