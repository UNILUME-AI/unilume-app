/**
 * Selection Agent — UI-level state for each demo scene.
 *
 * This file captures the "synthesis" layer above the three pure tool
 * responses (market / profit / timing). Fields here are NOT returned by
 * any single tool — they are either:
 *   (a) Agent-synthesized in final text (in the real #114 impl), or
 *   (b) Derived in the UI from the tool responses as a fallback.
 *
 * Mock policy: each scene has a hardcoded `SceneUIState`. The
 * `deriveVerdict` helper at the bottom is the **fallback** — used only
 * when the real Agent fails to emit a structured verdict. Its rules
 * double as living documentation of our "what makes a product good?"
 * criteria.
 */

import type { SceneId, VerdictTone } from "./scenes";
import type { MarketIntelligence, ProfitCalc, RiskItem } from "./types";

// ─── Types ─────────────────────────────────────────────────────

export interface Verdict {
  tone: VerdictTone;
  /** Short chip label next to tone color. E.g. "建议进入" */
  recommendLabel: string;
  /** 1-2 sentence summary shown as the big headline text. */
  summary: string;
}

export interface FollowUpSuggestion {
  /** What the user clicks — becomes their next message. */
  text: string;
  /** Optional hint: which scene this follow-up *would* transition to.
   *  UI uses this only in the mock harness; the real Agent re-routes. */
  nextScene?: SceneId;
}

export interface SceneUIState {
  verdict: Verdict;
  risks: RiskItem[];
  followUps: FollowUpSuggestion[];
  /** If true, render a FallbackCard above the analysis stack. */
  degraded: boolean;
  degradedReason?: string;
  /** Cost footer — independent of tool responses because it aggregates. */
  cost: {
    llmTokens: string;
    dataPayload: string;
    dbQueries: number;
    totalUsd: string;
  };
}

// ─── Per-scene hardcoded state ─────────────────────────────────
// For mock only. Real Agent either emits these fields or UI derives
// them via `deriveVerdict(...)` below.

const HAPPY_STATE: SceneUIState = {
  verdict: {
    tone: "positive",
    recommendLabel: "建议进入",
    summary:
      "基于当前数据，建议进入挂脖风扇品类。市场竞争中等，LED 屏显有差异化空间；利润率 40.5%、正赶上夏季备货窗口。最终是否投入由你根据资金和供应链情况决定。",
  },
  risks: [
    { severity: "warn", title: "强季节性", detail: "9 月后需求骤降约 60%，首批备货不超过 3 个月量" },
    { severity: "info", title: "入仓周期", detail: "FBN 入仓 1-2 周，建议 4 月底前发货以赶上 6 月需求起量" },
    { severity: "info", title: "差异化待验证", detail: "LED 屏显同品类仅 2-3 款有，但需验证消费者是否愿意为此溢价" },
  ],
  followUps: [
    { text: "对比 59 / 69 / 79 三个价位" },
    { text: "看看 KSA 市场怎么样", nextScene: "ksa" },
    { text: "备货计划和时间线" },
  ],
  degraded: false,
  cost: {
    llmTokens: "5.8k tokens",
    dataPayload: "150 KB",
    dbQueries: 3,
    totalUsd: "≈ $0.012",
  },
};

const ASK_MARKET_STATE: SceneUIState = HAPPY_STATE;   // after market chosen → same outcome
const GATHER_STATE: SceneUIState = HAPPY_STATE;       // after info gathered → same outcome

const KSA_STATE: SceneUIState = {
  verdict: {
    tone: "positive",
    recommendLabel: "建议进入",
    summary:
      "基于当前数据，建议进入便携榨汁杯品类。KSA 市场 FBN 渗透率 72%，Eid 后进入夏季饮品旺季。利润率约 36%、首批备货周期清晰。",
  },
  risks: [
    { severity: "warn", title: "VAT 15%", detail: "KSA VAT 明显高于 UAE 5%，已在利润计算中扣除" },
    { severity: "info", title: "入仓旺季", detail: "夏季旺季配送压力大，建议 4 月中前完成 FBN 入仓" },
  ],
  followUps: [
    { text: "对比 89 / 109 / 129 三个价位" },
    { text: "看 UAE 是不是更好", nextScene: "happy" },
    { text: "斋月期间怎么运营" },
  ],
  degraded: false,
  cost: {
    llmTokens: "6.1k tokens",
    dataPayload: "171 KB",
    dbQueries: 3,
    totalUsd: "≈ $0.013",
  },
};

const DEGRADED_STATE: SceneUIState = {
  verdict: {
    tone: "risky",
    recommendLabel: "建议谨慎",
    summary:
      "缺失市场竞争数据，只能从利润和时机维度给建议：按宠物品类平均费率，85 元采购可能花在利润率 15-25% 之间（偏薄）。暂不建议大批量投入，建议先重试市场数据或小批测试。",
  },
  risks: [
    { severity: "alert", title: "数据不完整", detail: "无市场竞争数据，无法判断竞品密度、价格带和进入门槛" },
    { severity: "warn", title: "宠物类品类", detail: "FBN 入仓需英文 Ingredient/Safety Label，对包装合规性要求高" },
    { severity: "warn", title: "退货率偏高", detail: "宠物电子类品类退货率 8-12%，需预留毛利空间" },
  ],
  followUps: [
    { text: "稍后重试市场数据" },
    { text: "换一个关键词试试" },
    { text: "先算 59 AED 和 79 AED 的利润" },
  ],
  degraded: true,
  degradedReason: "实时获取超时（>8s），市场竞争数据未取回",
  cost: {
    llmTokens: "4.2k tokens",
    dataPayload: "失败 · 0 KB",
    dbQueries: 2,
    totalUsd: "≈ $0.008",
  },
};

const NEGATIVE_STATE: SceneUIState = {
  verdict: {
    tone: "negative",
    recommendLabel: "建议观望",
    summary:
      "基于当前数据，不建议作为首次进入的品类。iPhone 17 数据线在 Noon UAE 竞争异常激烈（HHI 0.32 — 高度集中），顶层品牌占比 68%；以 6 元采购、按主流 10-15 AED 定价，扣除佣金 + FBN + 退货后利润率仅 6-8%。如你有品牌授权或渠道优势，结论可能不同。",
  },
  risks: [
    { severity: "alert", title: "竞争集中", detail: "HHI 0.32，Top 3 卖家 (Anker/Belkin/Baseus) 占 68% 份额" },
    { severity: "alert", title: "利润薄", detail: "按 12 AED 定价，每单净利约 0.9 AED，退货率 1-2% 即可穿透毛利" },
    { severity: "warn", title: "平台风险", detail: "MFi 未授权的第三方数据线有被下架风险" },
  ],
  followUps: [
    { text: "换一个竞争小的配件品" },
    { text: "我有货源，帮我重算" },
    { text: "看看 KSA 是不是好一点" },
  ],
  degraded: false,
  cost: {
    llmTokens: "5.1k tokens",
    dataPayload: "缓存命中 · 0 KB",
    dbQueries: 4,
    totalUsd: "≈ $0.006",
  },
};

// ─── Scene → UI state routing ──────────────────────────────────

const SCENE_STATES: Record<SceneId, SceneUIState> = {
  happy: HAPPY_STATE,
  ask_market: ASK_MARKET_STATE,
  gather: GATHER_STATE,
  ksa: KSA_STATE,
  degraded: DEGRADED_STATE,
  negative: NEGATIVE_STATE,
};

export function getSceneUIState(scene: SceneId): SceneUIState {
  return SCENE_STATES[scene];
}

// ─── deriveVerdict — fallback rule-based heuristic ─────────────
// Used when the live Agent (#114) fails to emit a structured verdict.
// Inputs: the 3 successful tool responses. Output: a Verdict.
// TODO(you): implement the rules. See the prompt in the chat for guidance.

/**
 * Fallback verdict derivation — UI safety net for when the Agent's
 * structured output is missing or malformed.
 *
 * Decision order (matters):
 *   1. Hard negatives first — a single blocker is enough to say "no",
 *      even on incomplete data (e.g. if the market is clearly an ad-war
 *      zone, that's reason enough regardless of profit data).
 *   2. Missing-data next — never return "positive" without full signals.
 *   3. Positive requires THREE conditions (AND) — conservative bias.
 *   4. Everything else falls through to "risky" (gray zone).
 *
 * Asymmetry is intentional: as a selection advisor, false-negative
 * (missing an opportunity) is cheaper than false-positive (pushing
 * the user into a losing category).
 */
export function deriveVerdict(input: {
  market?: MarketIntelligence;
  profit?: ProfitCalc;
  /** timing not currently consumed by the heuristic — included for future use. */
}): Verdict {
  const comp = input.market?.competition;
  const margin = input.profit?.marginPct;

  // ── 1. Hard negatives (any single blocker → observe) ──────
  if (comp) {
    if (comp.hhi >= 0.25 || comp.top3SellerShare >= 0.6 || comp.sponsoredPct >= 0.45) {
      return {
        tone: "negative",
        recommendLabel: "建议观望",
        summary:
          "市场竞争高度集中或广告内卷严重，新卖家难以突围。除非你有品牌授权、独家货源或渠道优势，否则不建议作为首次进入的品类。",
      };
    }
  }
  if (margin !== undefined && margin < 0.10) {
    return {
      tone: "negative",
      recommendLabel: "建议观望",
      summary:
        "利润率过薄（<10%），退货率或汇率波动即可穿透毛利，单量放大也难以覆盖风险。建议换成客单价更高或供应链成本更低的品类。",
    };
  }

  // ── 2. Missing signals → never confident enough for "go" ──
  if (!input.market || !input.profit || !comp || margin === undefined) {
    return {
      tone: "risky",
      recommendLabel: "建议谨慎",
      summary:
        "数据不完整，无法给出明确判断。建议先重试补全市场或利润数据，或用 50-100 件小批测试验证真实需求与转化率。",
    };
  }

  // ── 3. Positive: dispersed market + healthy margin + entry OK ──
  const marketDispersed = comp.hhi <= 0.15;
  const marginHealthy = margin >= 0.25;
  const entryOk = comp.entryDifficulty !== "high";
  if (marketDispersed && marginHealthy && entryOk) {
    return {
      tone: "positive",
      recommendLabel: "建议进入",
      summary:
        "市场分散无垄断者、利润率健康、新卖家进入难度可控。综合判断这是合理的选品候选，最终是否投入由你根据资金、供应链和风险偏好决定。",
    };
  }

  // ── 4. Gray zone: any of the three positives fails ────────
  return {
    tone: "risky",
    recommendLabel: "建议谨慎",
    summary:
      "利润或竞争存在瑕疵（未触发红线但不够全绿）。建议先小批测试 50-100 件验证转化，视结果再决定是否放量。",
  };
}
