/**
 * Selection Agent — business data types for the 3 tools.
 *
 * These types define the `T` in `ToolResponse<T>` for the three tools that
 * power the Selection Agent UI:
 *   - market_intelligence  →  MarketIntelligence
 *   - profit_calculator    →  ProfitCalc
 *   - timing_intelligence  →  TimingIntel
 *
 * NOTE: Kept intentionally free of UI-layer concerns like "verdict tone" or
 * "recommendation text". Those are derived in `ui-state.ts` because they are
 * a *synthesis* across all three tools, not the output of any single one.
 *
 * When #113 (market_intelligence tool) lands, its return value should be
 * replaced with the real schema here. The UI components consume only these
 * types, so the mock ↔ real switchover is a single import change.
 */

import type { ToolResponse } from "../types";

// Re-export for convenience — downstream mock fixtures use these.
export type { ToolResponse, ToolResponseMeta } from "../types";
export {
  toolSuccess,
  toolPartial,
  toolNotFound,
  toolError,
} from "../types";

// ─── Common primitives ─────────────────────────────────────────

export type Currency = "AED" | "SAR";
export type Market = "UAE" | "KSA";

/** Qualitative competition level for sub-categories and markets. */
export type CompetitionLevel = "low" | "mod" | "high";

/** Event / timing relevance to the queried product. */
export type Relevance = "high" | "mid" | "low" | "none";

/** Tag styling hint for timing events. `mute` is used for non-relevant (e.g. off-season). */
export type EventTag = "hot" | "warm" | "info" | "mute";

/**
 * Monetary amount with explicit currency.
 * Use integers/decimals directly; do not round at the type level.
 */
export interface Money {
  amount: number;
  currency: Currency;
}

// ─── 1. MarketIntelligence ─────────────────────────────────────
// Shape of data returned by the `market_intelligence` tool.

/**
 * A sub-category the user can pick after the initial keyword-level search.
 * Example: keyword="portable fan" → { name: "Neck Fans", count: 800, ... }
 *
 * `competitionLevel` is a qualitative bucket derived from HHI + review
 * barrier; `competitionScore` is the 0–5 filled-bar count for the UI widget.
 */
export interface SubCategory {
  id: string;
  name: string;           // English canonical name
  nameZh: string;         // 中文名（picker 上 secondary display）
  count: number;          // independent product count (dedup'd)
  priceBand: { min: number; max: number; currency: Currency };
  competitionLevel: CompetitionLevel;
  competitionScore: 1 | 2 | 3 | 4 | 5;
}

/**
 * Price distribution statistics for a keyword or sub-category.
 * Used by PriceRangeBar and the "建议定价" recommendation.
 */
export interface PriceDistribution {
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  currency: Currency;
  suggestedPrice: number;     // agent-anchored recommendation
  suggestionReason: string;   // human-readable why: "高于中位，LED 屏显支撑溢价"
}

/**
 * Competition metrics — used by both the overview card and the detail panel.
 */
export interface CompetitionMetrics {
  hhi: number;                // Herfindahl-Hirschman Index (0–1)
  top3SellerShare: number;    // 0–1, fraction of products held by top-3 sellers
  reviewBarrier: number;      // median review count of top products
  entryDifficulty: "low" | "mid" | "high";
  sponsoredPct: number;       // 0–1, fraction of search results that are Ads
  fbnPct: number;             // 0–1, fraction of products fulfilled by Noon
}

/**
 * A single competitor product surfaced in the Top-10 table.
 */
export interface CompetitorProduct {
  position: number;
  title: string;
  sku: string;
  price: number;              // in `currency` of the surrounding response
  rating: number | null;
  reviews: number;
  tags: Array<"fbn" | "sponsored">;
}

/**
 * A seller / merchant on Noon — used in the "卖家分布" section of MarketDetail.
 */
export interface SellerDistribution {
  rank: number;
  name: string;
  productCount: number;
  sharePct: number;           // 0–1, fraction of dedup'd market
}

/**
 * Full MarketIntelligence payload.
 *
 * For the happy path all fields are populated. For the `degraded` scenario
 * the tool returns `toolPartial(...)` with most fields omitted — which is
 * why most fields below are **optional**. The UI checks presence before render.
 */
export interface MarketIntelligence {
  keyword: string;
  market: Market;
  locale: string;             // "en-ae" | "en-sa"

  // ─ Headline KPIs (shown on the card) ─────────────
  independentProductCount?: number;   // dedup'd
  sellerCount?: number;
  priceBand?: { min: number; max: number; currency: Currency };
  medianPrice?: number;

  // ─ Sub-category picker options (first-round) ─────
  subCategories?: SubCategory[];

  // ─ Deeper analytics (shown in detail panel) ──────
  priceDistribution?: PriceDistribution;
  competition?: CompetitionMetrics;
  topCompetitors?: CompetitorProduct[];
  topSellers?: SellerDistribution[];

  // ─ Agent-written narrative rendered under the KPIs ─
  narrative?: string;
}

// ─── 2. ProfitCalc ─────────────────────────────────────────────
// Shape of data returned by the `profit_calculator` tool.

/**
 * Semantic category for a ProfitLine. Use this (not the human `label`)
 * for any programmatic lookup — labels change for copy / i18n, category
 * is stable.
 */
export type ProfitCategory =
  | "sale_price"
  | "commission"
  | "fbn_fee"
  | "purchase"
  | "freight"
  | "return"
  | "vat";

/**
 * One line item in the profit breakdown — either income or a deduction.
 * `pctOfRevenue` is always expressed as a fraction of `salePrice`.
 */
export interface ProfitLine {
  /** Stable semantic identifier — use for lookups. */
  category: ProfitCategory;
  /** Human-readable display name — may change for copy / i18n. */
  label: string;              // "销售佣金" | "FBN 物流费" | ...
  note?: string;              // "¥35 × 0.51" | "0.5kg 海运" | ...
  amount: number;             // positive even for deductions
  pctOfRevenue: number;       // 0–1, e.g. 0.15 for 15%
  kind: "revenue" | "deduction" | "memo";
}

/** Fee-rate / cost assumptions used in the calculation. */
export interface ProfitAssumptions {
  commissionRate: number;     // 0.15 = 15%
  fbnFee: number;             // flat fee in `currency`
  fxRate: number;             // 1 CNY = fxRate × AED/SAR
  fxRateTolerance: number;    // ±0.02 = ±2%
  returnRate: number;         // 0.04 = 4%
  dailySalesEstimate: number; // units/day — used for payback-period calc
}

export interface ProfitCalc {
  market: Market;
  currency: Currency;

  // ─ Primary numbers ─────────────────────────────
  suggestedPrice: number;          // AED/SAR sale price
  purchaseCostRmb: number;         // ¥ (before FX)
  netProfitPerUnit: number;        // in `currency`
  marginPct: number;               // 0–1
  roiPct: number;                  // 0–∞
  totalCostPerUnit: number;        // in `currency`

  // ─ Detailed breakdown ──────────────────────────
  breakdown: ProfitLine[];         // rendered as profit-lines in the card

  // ─ Transparent assumptions ─────────────────────
  assumptions: ProfitAssumptions;
}

// ─── 3. TimingIntel ────────────────────────────────────────────
// Shape of data returned by the `timing_intelligence` tool.

/**
 * A single event on the yearly calendar. `relevance` says how much this
 * event matters to the queried product — UI shows it as a colored tag.
 */
export interface TimingEvent {
  name: string;               // "Summer Sale" | "Ramadan" | ...
  date: string;               // human-readable: "7 月中" | "6-8 月" | ...
  categories: string;         // "服装/礼品/电子"
  relevance: Relevance;       // drives tag color + "季节错配" label
}

/**
 * Current time-phase summary — the opening line of the timing card.
 */
export interface CurrentPhase {
  name: string;               // "入夏前备货期"
  demandLevel: string;        // "温和回升中"
  recommendedAction: string;  // "立即备货，把握 6-8 月峰值"
}

/**
 * Forward-looking demand outlook across 30/90/180-day horizons.
 */
export interface DemandOutlook {
  days30: { label: string; detail: string };   // "稳步回升" / "需求从温和转为明显上升"
  days90: { label: string; detail: string };
  days180: { label: string; detail: string };
  riskWindow: { label: string; detail: string }; // "9 月之后" / "需求骤降 60%"
}

export interface TimingIntel {
  market: Market;
  category?: string;

  currentPhase: CurrentPhase;
  events: TimingEvent[];
  outlook: DemandOutlook;

  // ─ Key dates surfaced on the card ─────────────
  peakWindow?: { label: string; date: string };   // "夏季高温期" / "6-8 月"
  stockCutoff?: { label: string; date: string };  // "备货截止建议" / "4 月底"
}

// ─── 4. Risk — shared by any tool or agent synthesis ───────────

export interface RiskItem {
  severity: "info" | "warn" | "alert";
  title: string;              // "强季节性" | "入仓周期" | ...
  detail: string;              // "9 月后需求骤降约 60%，首批备货不超过 3 个月量"
}

// ─── 5. Typed aliases for ToolResponse of each tool ────────────
// These save repetition in mock fixtures and (later) in the real tool impls.

export type MarketIntelligenceResponse = ToolResponse<MarketIntelligence>;
export type ProfitCalcResponse = ToolResponse<ProfitCalc>;
export type TimingIntelResponse = ToolResponse<TimingIntel>;
