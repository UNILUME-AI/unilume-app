/**
 * Mock streaming event layer — simulates the Agent's streaming response
 * for design-review purposes.
 *
 * Shape deliberately mirrors the AI SDK v6 event vocabulary (narrative
 * → tool-call → tool-result → text → end) so the hook that consumes it
 * can swap to a real stream with minimal changes in #114.
 */

import type { SceneId } from "./scenes";

export type ToolName =
  | "market_intelligence"
  | "profit_calculator"
  | "timing_intelligence";

export type ToolStatus = "pending" | "running" | "success" | "error";

/**
 * Events yielded by `mockStream()`. Each has an implicit delay
 * **before** it's yielded — `delayMs` in the event tuple is how long
 * the consumer should wait AFTER applying this frame before the next.
 */
export type MockStreamEvent =
  | { kind: "narrative"; text: string; delayMs: number }
  | { kind: "tool-running"; tool: ToolName; hint?: string; delayMs: number }
  | { kind: "tool-success"; tool: ToolName; elapsedMs: number; delayMs: number }
  | { kind: "tool-error"; tool: ToolName; reason: string; delayMs: number }
  | { kind: "analysis-ready"; delayMs: number }
  | { kind: "followups-ready"; delayMs: number };

// ─── Helpers ───────────────────────────────────────────────────

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// ─── Per-scene streams ─────────────────────────────────────────

/**
 * Happy path — all 3 tools succeed in parallel with staggered finish
 * order matching their real latency (profit/timing fast, market slower).
 */
async function* happyStream(): AsyncGenerator<MockStreamEvent> {
  yield {
    kind: "narrative",
    text: "正在并行查询 3 个数据源，已有缓存的会秒回。",
    delayMs: 300,
  };
  yield { kind: "tool-running", tool: "profit_calculator", hint: "计算中…", delayMs: 120 };
  yield { kind: "tool-running", tool: "timing_intelligence", hint: "查询日历…", delayMs: 160 };
  yield { kind: "tool-running", tool: "market_intelligence", hint: "查询市场数据…", delayMs: 400 };

  yield { kind: "tool-success", tool: "profit_calculator", elapsedMs: 120, delayMs: 500 };
  yield { kind: "tool-success", tool: "timing_intelligence", elapsedMs: 160, delayMs: 300 };

  yield {
    kind: "tool-running",
    tool: "market_intelligence",
    hint: "整理 150 个产品数据…",
    delayMs: 1200,
  };
  yield { kind: "tool-success", tool: "market_intelligence", elapsedMs: 5200, delayMs: 500 };

  yield { kind: "analysis-ready", delayMs: 200 };
  yield { kind: "followups-ready", delayMs: 150 };
}

/**
 * Degraded — profit/timing succeed, market_intelligence times out.
 * Surfaces a different narrative after the failure and triggers the
 * FallbackCard path in the UI.
 */
async function* degradedStream(): AsyncGenerator<MockStreamEvent> {
  yield {
    kind: "narrative",
    text:
      "宠物喜食器不在预缓存关键词中，我先实时获取 Noon UAE 的数据，稍等几秒。",
    delayMs: 300,
  };
  yield { kind: "tool-running", tool: "profit_calculator", hint: "计算中…", delayMs: 120 };
  yield { kind: "tool-running", tool: "timing_intelligence", hint: "查询日历…", delayMs: 160 };
  yield {
    kind: "tool-running",
    tool: "market_intelligence",
    hint: "实时获取中 (3 页，8s 超时)…",
    delayMs: 400,
  };

  yield { kind: "tool-success", tool: "profit_calculator", elapsedMs: 120, delayMs: 700 };
  yield { kind: "tool-success", tool: "timing_intelligence", elapsedMs: 160, delayMs: 300 };

  yield {
    kind: "tool-running",
    tool: "market_intelligence",
    hint: "重试中（平台验证）…",
    delayMs: 2200,
  };
  yield {
    kind: "tool-error",
    tool: "market_intelligence",
    reason: "数据获取超时",
    delayMs: 500,
  };

  yield { kind: "analysis-ready", delayMs: 200 };
  yield { kind: "followups-ready", delayMs: 150 };
}

/**
 * Negative path — all tools hit cache (fast), Agent still recommends
 * against entering the category.
 */
async function* negativeStream(): AsyncGenerator<MockStreamEvent> {
  yield {
    kind: "narrative",
    text: "数据线是超高竞争品类，先拉市场和利润数据核对。",
    delayMs: 250,
  };
  yield { kind: "tool-running", tool: "profit_calculator", hint: "计算中…", delayMs: 120 };
  yield { kind: "tool-running", tool: "timing_intelligence", hint: "查询日历…", delayMs: 160 };
  yield {
    kind: "tool-running",
    tool: "market_intelligence",
    hint: "缓存命中 · 读取中…",
    delayMs: 250,
  };

  yield { kind: "tool-success", tool: "profit_calculator", elapsedMs: 95, delayMs: 400 };
  yield { kind: "tool-success", tool: "timing_intelligence", elapsedMs: 155, delayMs: 200 };
  yield { kind: "tool-success", tool: "market_intelligence", elapsedMs: 800, delayMs: 400 };

  yield { kind: "analysis-ready", delayMs: 200 };
  yield { kind: "followups-ready", delayMs: 150 };
}

/**
 * Ask-market — Agent asks for market first; for the demo we just
 * simulate a short narrative then jump to happy stream. In a real flow
 * the UI would interrupt to show a MarketPicker and only then resume.
 */
async function* askMarketStream(): AsyncGenerator<MockStreamEvent> {
  yield {
    kind: "narrative",
    text:
      "你想看 UAE 还是 KSA？两个市场的佣金/VAT/FBN 费率差别较大，先确定市场再分析。",
    delayMs: 300,
  };
  // After user picks market (implicit in mock demo), we continue to happy-style stream.
  yield* happyStream();
}

/**
 * Gather — missing market and cost; similar narrative prefix then
 * happy stream. Real UX shows the InfoGather form; for Phase 4 we
 * compress it into the stream.
 */
async function* gatherStream(): AsyncGenerator<MockStreamEvent> {
  yield {
    kind: "narrative",
    text:
      "先收集几个必要信息我才能给完整分析——市场、采购成本、发货方式。",
    delayMs: 300,
  };
  yield* happyStream();
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Stream mock events for the given scene. Each event already carries
 * its own `delayMs` — consumers should `await sleep(e.delayMs)` before
 * reading the next event (or apply the frame first then sleep).
 *
 * We intentionally return a generator rather than an array so consumers
 * can early-exit by breaking out of the `for await` loop.
 */
export async function* mockStream(scene: SceneId): AsyncGenerator<MockStreamEvent> {
  let source: AsyncGenerator<MockStreamEvent>;
  switch (scene) {
    case "happy":
    case "ksa":
      source = happyStream();
      break;
    case "ask_market":
      source = askMarketStream();
      break;
    case "gather":
      source = gatherStream();
      break;
    case "degraded":
      source = degradedStream();
      break;
    case "negative":
      source = negativeStream();
      break;
  }

  for await (const event of source) {
    yield event;
    await sleep(event.delayMs);
  }
}

// ─── State reducer ─────────────────────────────────────────────
// Converts the stream events into the view-model consumed by the hook.

export type StreamingPhase = "idle" | "streaming" | "ready";

export interface SelectionAgentState {
  phase: StreamingPhase;
  /** Agent's lead narrative line — rendered above the tool strip. */
  narrative: string | null;
  /** Per-tool status. */
  tools: Record<ToolName, ToolStatus>;
  /** Per-tool last hint text. */
  toolHints: Record<ToolName, string>;
  /** Per-tool elapsed ms (for success display). */
  toolElapsed: Record<ToolName, number | null>;
  /** True once all tools terminated (success or error). */
  toolsDone: boolean;
  /** Show verdict + analysis cards. */
  analysisReady: boolean;
  /** Show follow-up pills. */
  followupsReady: boolean;
}

const INITIAL_TOOLS: SelectionAgentState["tools"] = {
  market_intelligence: "pending",
  profit_calculator: "pending",
  timing_intelligence: "pending",
};

export function createInitialState(): SelectionAgentState {
  return {
    phase: "idle",
    narrative: null,
    tools: { ...INITIAL_TOOLS },
    toolHints: {
      market_intelligence: "",
      profit_calculator: "",
      timing_intelligence: "",
    },
    toolElapsed: {
      market_intelligence: null,
      profit_calculator: null,
      timing_intelligence: null,
    },
    toolsDone: false,
    analysisReady: false,
    followupsReady: false,
  };
}

/**
 * Pure reducer: apply one event to prior state.
 * Keeping this as a separate pure function makes the hook straightforward
 * to unit test (feed an event sequence, assert final state).
 */
export function applyEvent(
  prev: SelectionAgentState,
  event: MockStreamEvent,
): SelectionAgentState {
  switch (event.kind) {
    case "narrative":
      return { ...prev, phase: "streaming", narrative: event.text };

    case "tool-running":
      return {
        ...prev,
        phase: "streaming",
        tools: { ...prev.tools, [event.tool]: "running" },
        toolHints: { ...prev.toolHints, [event.tool]: event.hint ?? "" },
      };

    case "tool-success": {
      const nextTools = { ...prev.tools, [event.tool]: "success" as const };
      return {
        ...prev,
        tools: nextTools,
        toolElapsed: { ...prev.toolElapsed, [event.tool]: event.elapsedMs },
        toolsDone: allTerminated(nextTools),
      };
    }

    case "tool-error": {
      const nextTools = { ...prev.tools, [event.tool]: "error" as const };
      return {
        ...prev,
        tools: nextTools,
        toolHints: { ...prev.toolHints, [event.tool]: event.reason },
        toolsDone: allTerminated(nextTools),
      };
    }

    case "analysis-ready":
      return { ...prev, analysisReady: true };

    case "followups-ready":
      return { ...prev, phase: "ready", followupsReady: true };
  }
}

function allTerminated(tools: SelectionAgentState["tools"]): boolean {
  return Object.values(tools).every((s) => s === "success" || s === "error");
}
