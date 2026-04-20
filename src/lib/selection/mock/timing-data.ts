/**
 * Mock `timing_intelligence` tool responses for the 6 demo scenes.
 *
 * Timing data is fundamentally a lookup against a static calendar
 * (`event-calendar.json` per Sprint plan §A0.4). No external I/O, so
 * `data_source: "static"` with high confidence is realistic.
 *
 * When #112 (timing_intelligence tool) lands, these fixtures become
 * the shape of its return value — delete the exports, point callers
 * to the real tool.
 */

import type { SceneId } from "./scenes";
import {
  toolSuccess,
  type TimingEvent,
  type TimingIntel,
  type TimingIntelResponse,
} from "./types";

// ─── Event tables per product archetype ────────────────────────

/** Summer portable cooling product (UAE) — both fan & juicer fit this. */
const SUMMER_COOLING_EVENTS: TimingEvent[] = [
  { name: "Ramadan",           date: "3 月-4 月初",   categories: "食品/家居/礼品",  relevance: "none" },
  { name: "Eid al-Fitr",       date: "4 月初",        categories: "服装/礼品/电子",  relevance: "low" },
  { name: "夏季高温期",         date: "6-8 月",         categories: "风扇/空调/降温",  relevance: "high" },
  { name: "Summer Sale",       date: "7 月中",         categories: "全品类",           relevance: "high" },
  { name: "Back to School",    date: "8 月底",         categories: "文具/电子/服装",  relevance: "low" },
  { name: "White Friday",      date: "11 月",          categories: "全品类",           relevance: "none" },
  { name: "年底节日季",         date: "12 月",          categories: "礼品/电子",        relevance: "none" },
];

/** Year-round accessory (phone cable, pet feeder etc.). */
const YEAR_ROUND_ACCESSORY_EVENTS: TimingEvent[] = [
  { name: "Ramadan",           date: "3 月-4 月初",   categories: "食品/家居",         relevance: "low" },
  { name: "Eid al-Fitr",       date: "4 月初",        categories: "礼品/电子",        relevance: "mid" },
  { name: "Back to School",    date: "8 月底",         categories: "文具/电子/服装",  relevance: "mid" },
  { name: "White Friday",      date: "11 月",          categories: "全品类",           relevance: "high" },
  { name: "年底节日季",         date: "12 月",          categories: "礼品/电子",        relevance: "high" },
];

// ─── Scene payloads ────────────────────────────────────────────

const UAE_FAN_TIMING: TimingIntel = {
  market: "UAE",
  category: "portable fan",

  currentPhase: {
    name: "入夏前备货期",
    demandLevel: "温和回升中",
    recommendedAction: "立即备货，把握 6-8 月峰值",
  },

  events: SUMMER_COOLING_EVENTS,

  outlook: {
    days30:  { label: "稳步回升",    detail: "需求从温和转为明显上升" },
    days90:  { label: "进入高峰",    detail: "夏季高温核心销售期" },
    days180: { label: "高峰转回落",  detail: "9 月起需求逐步降温" },
    riskWindow: {
      label: "9 月之后",
      detail: "需求骤降 60%，避免积压库存",
    },
  },

  peakWindow:  { label: "夏季高温期", date: "6-8 月" },
  stockCutoff: { label: "备货截止建议", date: "4 月底" },
};

const KSA_JUICER_TIMING: TimingIntel = {
  market: "KSA",
  category: "portable juicer cup",

  currentPhase: {
    name: "斋月过渡期",
    demandLevel: "节前波动 · 节后回温",
    recommendedAction: "Eid 后入仓，承接夏季饮品旺季",
  },

  events: SUMMER_COOLING_EVENTS,  // same calendar, different phrasing

  outlook: {
    days30:  { label: "节后回温",    detail: "Eid 后家庭消费恢复" },
    days90:  { label: "进入旺季",    detail: "夏季冷饮习惯带动便携榨汁需求" },
    days180: { label: "平稳回落",    detail: "9 月起降温但仍保持中等需求" },
    riskWindow: {
      label: "9 月之后",
      detail: "需求回落约 40%，可用 White Friday 转季清库存",
    },
  },

  peakWindow:  { label: "夏季饮品旺季", date: "6-9 月" },
  stockCutoff: { label: "备货截止建议",   date: "4 月中" },
};

const UAE_DEGRADED_TIMING: TimingIntel = {
  market: "UAE",
  category: "pet automatic feeder",

  currentPhase: {
    name: "常态期",
    demandLevel: "全年稳定",
    recommendedAction: "无明显季节性，可滚动补货",
  },

  events: YEAR_ROUND_ACCESSORY_EVENTS,

  outlook: {
    days30:  { label: "平稳",      detail: "日常宠物用品需求无明显波动" },
    days90:  { label: "平稳",      detail: "" },
    days180: { label: "White Friday 放量", detail: "年末大促可推动爆发" },
    riskWindow: {
      label: "暂无明显风险窗口",
      detail: "全年需求稳定，滚动补货风险低",
    },
  },
};

const UAE_IPHONE_CABLE_TIMING: TimingIntel = {
  market: "UAE",
  category: "iphone 17 data cable",

  currentPhase: {
    name: "iPhone 17 上市后 6 个月",
    demandLevel: "高但竞争激烈",
    recommendedAction: "需求端良好，但竞争决定不建议进入",
  },

  events: YEAR_ROUND_ACCESSORY_EVENTS,

  outlook: {
    days30:  { label: "保持高位",    detail: "iPhone 17 用户仍在配件补充期" },
    days90:  { label: "需求持续",    detail: "但新机型 iPhone 18 可能挤压" },
    days180: { label: "逐步转移",    detail: "若 iPhone 18 发布，数据线规格可能变化" },
    riskWindow: {
      label: "iPhone 18 发布窗口",
      detail: "新机型可能改变接口标准，库存规划需保守",
    },
  },
};

// ─── Scene → fixture routing ───────────────────────────────────

export function getMockTimingResponse(scene: SceneId): TimingIntelResponse {
  const commonMeta = {
    data_source: "static" as const,
    confidence: "high" as const,
    confidence_note: "基于 2026-2028 中东节日 + 商业事件日历",
    cost: { db_queries: 0 },
  };

  switch (scene) {
    case "happy":
    case "ask_market":
    case "gather":
      return toolSuccess(UAE_FAN_TIMING, { latency_ms: 150, ...commonMeta });

    case "ksa":
      return toolSuccess(KSA_JUICER_TIMING, { latency_ms: 160, ...commonMeta });

    case "degraded":
      return toolSuccess(UAE_DEGRADED_TIMING, { latency_ms: 140, ...commonMeta });

    case "negative":
      return toolSuccess(UAE_IPHONE_CABLE_TIMING, { latency_ms: 155, ...commonMeta });
  }
}
