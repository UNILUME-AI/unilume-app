import { describe, it, expect } from "vitest";
import { SCENES } from "../scenes";
import { getSceneUIState, deriveVerdict } from "../ui-state";
import { getMockMarketResponse } from "../market-data";
import { getMockProfitResponse } from "../profit-data";

/**
 * Sanity: the rule-based `deriveVerdict` fallback must produce a tone
 * consistent with the hardcoded `SceneUIState` for every canonical scene.
 *
 * If this test starts failing after tweaking thresholds in `deriveVerdict`,
 * you've either (a) changed the rules meaningfully (review fixtures), or
 * (b) introduced a real regression in the heuristic.
 */
describe("deriveVerdict — fallback heuristic", () => {
  it.each(SCENES)("scene '%s' — tone matches hardcoded SceneUIState", (scene) => {
    const hardcoded = getSceneUIState(scene).verdict.tone;

    const market = getMockMarketResponse(scene);
    const profit = getMockProfitResponse(scene);

    const derived = deriveVerdict({
      market: market.data ?? undefined,
      profit: profit.data ?? undefined,
    });

    expect(derived.tone).toBe(hardcoded);
  });

  it("returns 'risky' when both inputs are undefined", () => {
    const v = deriveVerdict({});
    expect(v.tone).toBe("risky");
    expect(v.recommendLabel).toBe("建议谨慎");
  });

  it("returns 'negative' on concentrated market (HHI ≥ 0.25) even without profit", () => {
    const v = deriveVerdict({
      market: {
        keyword: "test",
        market: "UAE",
        locale: "en-ae",
        competition: {
          hhi: 0.32,
          top3SellerShare: 0.68,
          reviewBarrier: 200,
          entryDifficulty: "high",
          sponsoredPct: 0.48,
          fbnPct: 0.85,
        },
      },
    });
    expect(v.tone).toBe("negative");
  });

  it("returns 'negative' on thin margin (<10%)", () => {
    const v = deriveVerdict({
      market: {
        keyword: "test",
        market: "UAE",
        locale: "en-ae",
        competition: {
          hhi: 0.08,
          top3SellerShare: 0.1,
          reviewBarrier: 20,
          entryDifficulty: "low",
          sponsoredPct: 0.15,
          fbnPct: 0.5,
        },
      },
      profit: {
        market: "UAE",
        currency: "AED",
        suggestedPrice: 50,
        purchaseCostRmb: 30,
        netProfitPerUnit: 4,
        marginPct: 0.08,
        roiPct: 0.09,
        totalCostPerUnit: 46,
        breakdown: [],
        assumptions: {
          commissionRate: 0.15,
          fbnFee: 5.5,
          fxRate: 0.51,
          fxRateTolerance: 0.02,
          returnRate: 0.04,
          dailySalesEstimate: 5,
        },
      },
    });
    expect(v.tone).toBe("negative");
  });
});
