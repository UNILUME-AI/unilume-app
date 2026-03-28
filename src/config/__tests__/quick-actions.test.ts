import { describe, it, expect } from "vitest";
import { QUICK_ACTIONS } from "../quick-actions";

describe("QUICK_ACTIONS", () => {
  it("has at least one action", () => {
    expect(QUICK_ACTIONS.length).toBeGreaterThan(0);
  });

  it("each action has icon and text", () => {
    for (const action of QUICK_ACTIONS) {
      expect(action.icon).toBeTruthy();
      expect(action.text).toBeTruthy();
      expect(action.text.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate texts", () => {
    const texts = QUICK_ACTIONS.map((a) => a.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
