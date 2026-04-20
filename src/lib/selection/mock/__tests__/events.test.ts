import { describe, it, expect } from "vitest";
import {
  applyEvent,
  createInitialState,
  mockStream,
  type MockStreamEvent,
} from "../events";
import { SCENES } from "../scenes";

describe("events — applyEvent reducer", () => {
  it("narrative event sets phase=streaming and captures text", () => {
    const s0 = createInitialState();
    const s1 = applyEvent(s0, {
      kind: "narrative",
      text: "正在分析",
      delayMs: 0,
    });
    expect(s1.phase).toBe("streaming");
    expect(s1.narrative).toBe("正在分析");
  });

  it("tool-running marks exactly that tool as running", () => {
    const s = applyEvent(createInitialState(), {
      kind: "tool-running",
      tool: "market_intelligence",
      hint: "查询中",
      delayMs: 0,
    });
    expect(s.tools.market_intelligence).toBe("running");
    expect(s.tools.profit_calculator).toBe("pending");
    expect(s.toolHints.market_intelligence).toBe("查询中");
  });

  it("all three successes flip toolsDone to true", () => {
    let s = createInitialState();
    for (const tool of ["market_intelligence", "profit_calculator", "timing_intelligence"] as const) {
      s = applyEvent(s, {
        kind: "tool-success",
        tool,
        elapsedMs: 500,
        delayMs: 0,
      });
    }
    expect(s.toolsDone).toBe(true);
    expect(s.tools.market_intelligence).toBe("success");
    expect(s.toolElapsed.market_intelligence).toBe(500);
  });

  it("mixed success + error still triggers toolsDone", () => {
    let s = createInitialState();
    s = applyEvent(s, { kind: "tool-success", tool: "profit_calculator", elapsedMs: 100, delayMs: 0 });
    s = applyEvent(s, { kind: "tool-success", tool: "timing_intelligence", elapsedMs: 100, delayMs: 0 });
    s = applyEvent(s, {
      kind: "tool-error",
      tool: "market_intelligence",
      reason: "超时",
      delayMs: 0,
    });
    expect(s.toolsDone).toBe(true);
    expect(s.tools.market_intelligence).toBe("error");
    expect(s.toolHints.market_intelligence).toBe("超时");
  });

  it("followups-ready sets phase=ready", () => {
    const s = applyEvent(createInitialState(), {
      kind: "followups-ready",
      delayMs: 0,
    });
    expect(s.phase).toBe("ready");
    expect(s.followupsReady).toBe(true);
  });
});

describe("events — mockStream generator", () => {
  it.each(SCENES)(
    "scene '%s' terminates by emitting analysis-ready + followups-ready",
    { timeout: 15_000 },   // streams sleep ~3-5s each
    async (scene) => {
      const events: MockStreamEvent["kind"][] = [];
      for await (const e of mockStream(scene)) {
        events.push(e.kind);
      }
      expect(events).toContain("analysis-ready");
      expect(events).toContain("followups-ready");
      // analysis must precede followups
      expect(events.lastIndexOf("analysis-ready")).toBeLessThan(
        events.lastIndexOf("followups-ready"),
      );
    },
  );

  it(
    "degraded scene ends with market tool in error state",
    { timeout: 15_000 },
    async () => {
      let lastMarket: MockStreamEvent | null = null;
      for await (const e of mockStream("degraded")) {
        if ((e.kind === "tool-running" || e.kind === "tool-success" || e.kind === "tool-error") && e.tool === "market_intelligence") {
          lastMarket = e;
        }
      }
      expect(lastMarket?.kind).toBe("tool-error");
    },
  );
});
