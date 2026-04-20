import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useMockSelectionAgent } from "../useMockSelectionAgent";

describe("useMockSelectionAgent", () => {
  it(
    "scene='happy' transitions through streaming → ready",
    { timeout: 15_000 },
    async () => {
      const { result } = renderHook(() => useMockSelectionAgent("happy"));

      // Initial state
      expect(result.current.phase).toBe("idle");
      expect(result.current.analysisReady).toBe(false);
      expect(result.current.followupsReady).toBe(false);

      // After stream runs, phase should reach "ready"
      await waitFor(() => expect(result.current.phase).toBe("ready"), {
        timeout: 12_000,
      });

      // All tools succeeded
      expect(result.current.tools.market_intelligence).toBe("success");
      expect(result.current.tools.profit_calculator).toBe("success");
      expect(result.current.tools.timing_intelligence).toBe("success");
      expect(result.current.toolsDone).toBe(true);
      expect(result.current.analysisReady).toBe(true);
      expect(result.current.followupsReady).toBe(true);
      expect(result.current.narrative).toContain("并行查询");
    },
  );

  it(
    "scene='degraded' ends with market_intelligence in error state",
    { timeout: 15_000 },
    async () => {
      const { result } = renderHook(() => useMockSelectionAgent("degraded"));

      await waitFor(() => expect(result.current.phase).toBe("ready"), {
        timeout: 12_000,
      });

      expect(result.current.tools.market_intelligence).toBe("error");
      expect(result.current.tools.profit_calculator).toBe("success");
      expect(result.current.tools.timing_intelligence).toBe("success");
      expect(result.current.toolsDone).toBe(true);
      expect(result.current.analysisReady).toBe(true);
    },
  );

  it(
    "scene change resets state and restarts stream",
    { timeout: 20_000 },
    async () => {
      const { result, rerender } = renderHook(
        ({ scene }: { scene: "happy" | "negative" }) => useMockSelectionAgent(scene),
        { initialProps: { scene: "happy" } },
      );

      await waitFor(() => expect(result.current.phase).toBe("ready"), {
        timeout: 12_000,
      });

      // Switch scene → state should reset
      rerender({ scene: "negative" });
      expect(result.current.phase).toBe("idle");
      expect(result.current.analysisReady).toBe(false);

      // Eventually reaches ready again for new scene
      await waitFor(() => expect(result.current.phase).toBe("ready"), {
        timeout: 6_000,
      });
    },
  );
});
