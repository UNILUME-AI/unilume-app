/**
 * Mock `market_intelligence` tool responses for the 6 demo scenes.
 *
 * All numeric values mirror those in the approved HTML prototype
 * (`unilume-docs/ui/UNILUME-Agent-UI-v3.html`). Use this file as the
 * single source of truth for mock dashboard numbers — subsequent UI
 * components must read from here, not hard-code from their own memory.
 *
 * Replacement path: once #113 (market_intelligence tool) lands, delete
 * this file's named exports and re-point imports to the real tool call.
 */

import type { SceneId } from "./scenes";
import {
  toolSuccess,
  toolPartial,
  type MarketIntelligence,
  type MarketIntelligenceResponse,
} from "./types";

// ─── Helpers ───────────────────────────────────────────────────

const NOW_ISO = "2026-04-20T10:00:00Z";

// ─── UAE happy-path market (reused by ask_market + gather + happy) ─

const UAE_PORTABLE_FAN: MarketIntelligence = {
  keyword: "portable fan",
  market: "UAE",
  locale: "en-ae",

  independentProductCount: 350,
  sellerCount: 40,
  priceBand: { min: 49, max: 89, currency: "AED" },
  medianPrice: 65,

  subCategories: [
    {
      id: "desk-fans",
      name: "Desk Fans",
      nameZh: "桌面风扇",
      count: 3000,
      priceBand: { min: 29, max: 45, currency: "AED" },
      competitionLevel: "high",
      competitionScore: 4,
    },
    {
      id: "neck-fans",
      name: "Neck Fans",
      nameZh: "挂脖风扇",
      count: 800,
      priceBand: { min: 49, max: 89, currency: "AED" },
      competitionLevel: "mod",
      competitionScore: 3,
    },
    {
      id: "handheld-fans",
      name: "Handheld Fans",
      nameZh: "手持风扇",
      count: 600,
      priceBand: { min: 35, max: 59, currency: "AED" },
      competitionLevel: "mod",
      competitionScore: 3,
    },
    {
      id: "mist-fans",
      name: "Mist Fans",
      nameZh: "喷雾风扇",
      count: 200,
      priceBand: { min: 69, max: 129, currency: "AED" },
      competitionLevel: "low",
      competitionScore: 2,
    },
  ],

  priceDistribution: {
    min: 15,
    p25: 49,
    median: 65,
    p75: 89,
    max: 189,
    currency: "AED",
    suggestedPrice: 69,
    suggestionReason: "高于中位，LED 屏显支撑溢价",
  },

  competition: {
    hhi: 0.08,
    top3SellerShare: 0.12,
    reviewBarrier: 28,
    entryDifficulty: "mid",
    sponsoredPct: 0.28,
    fbnPct: 0.65,
  },

  topCompetitors: [
    { position: 1, title: "Portable Neck Fan USB Rechargeable", sku: "N53001", price: 59, rating: 4.5, reviews: 127, tags: ["fbn"] },
    { position: 2, title: "Mini Neck Fan LED Display 3 Speed", sku: "N53002", price: 69, rating: 4.3, reviews: 89, tags: ["fbn"] },
    { position: 3, title: "Bladeless Neck Fan Hands Free", sku: "N53003", price: 45, rating: 4.1, reviews: 234, tags: ["fbn", "sponsored"] },
    { position: 4, title: "Portable Neck Fan 5000mAh Battery", sku: "N53004", price: 79, rating: 4.4, reviews: 56, tags: ["fbn"] },
    { position: 5, title: "Wearable Neck Fan Cooling Device", sku: "N53005", price: 55, rating: 3.9, reviews: 18, tags: [] },
    { position: 6, title: "Neck Fan with LED Screen Display", sku: "N53006", price: 75, rating: 4.6, reviews: 42, tags: ["fbn", "sponsored"] },
    { position: 7, title: "Mini USB Rechargeable Neck Fan", sku: "N53007", price: 35, rating: 4.0, reviews: 312, tags: ["sponsored"] },
    { position: 8, title: "Portable Hanging Neck Fan Quiet", sku: "N53008", price: 49, rating: 4.2, reviews: 67, tags: ["fbn"] },
    { position: 9, title: "Sports Neck Fan Lightweight 200g", sku: "N53009", price: 89, rating: 4.7, reviews: 23, tags: ["fbn"] },
    { position: 10, title: "360° Cooling Neck Fan Bladeless", sku: "N53010", price: 65, rating: 4.1, reviews: 95, tags: ["fbn"] },
  ],

  topSellers: [
    { rank: 1, name: "NoonStore UAE", productCount: 8, sharePct: 0.053 },
    { rank: 2, name: "CoolGadgets", productCount: 6, sharePct: 0.04 },
    { rank: 3, name: "FanWorld", productCount: 4, sharePct: 0.027 },
    { rank: 4, name: "TechDeals ME", productCount: 3, sharePct: 0.02 },
    { rank: 5, name: "GreenLife Store", productCount: 3, sharePct: 0.02 },
  ],

  narrative:
    "Neck Fans 在 Noon UAE 属于中等竞争市场，卖家分散无垄断者，评论壁垒低，新卖家进入难度中等。你的 LED 屏显功能在同品类中仅 2-3 款有，具备差异化空间。",
};

// ─── KSA variant — portable juicer cup ─────────────────────────

const KSA_JUICER_CUP: MarketIntelligence = {
  keyword: "portable juicer cup",
  market: "KSA",
  locale: "en-sa",

  independentProductCount: 420,
  sellerCount: 55,
  priceBand: { min: 75, max: 139, currency: "SAR" },
  medianPrice: 99,

  subCategories: [
    {
      id: "ksa-juicer-personal",
      name: "Personal Blenders",
      nameZh: "个人搅拌杯",
      count: 1200,
      priceBand: { min: 69, max: 129, currency: "SAR" },
      competitionLevel: "high",
      competitionScore: 4,
    },
    {
      id: "ksa-juicer-portable",
      name: "Portable Juicer Cups",
      nameZh: "便携榨汁杯",
      count: 500,
      priceBand: { min: 75, max: 139, currency: "SAR" },
      competitionLevel: "mod",
      competitionScore: 3,
    },
    {
      id: "ksa-juicer-citrus",
      name: "Citrus Juicers",
      nameZh: "柑橘榨汁器",
      count: 300,
      priceBand: { min: 49, max: 89, currency: "SAR" },
      competitionLevel: "low",
      competitionScore: 2,
    },
    {
      id: "ksa-juicer-masticating",
      name: "Slow Juicers",
      nameZh: "慢速榨汁机",
      count: 180,
      priceBand: { min: 249, max: 599, currency: "SAR" },
      competitionLevel: "low",
      competitionScore: 2,
    },
  ],

  priceDistribution: {
    min: 29,
    p25: 75,
    median: 99,
    p75: 139,
    max: 299,
    currency: "SAR",
    suggestedPrice: 109,
    suggestionReason: "略高于中位，USB-C 快充 + 大容量杯身支撑溢价",
  },

  competition: {
    hhi: 0.06,
    top3SellerShare: 0.1,
    reviewBarrier: 35,
    entryDifficulty: "mid",
    sponsoredPct: 0.22,
    fbnPct: 0.72,
  },

  topSellers: [
    { rank: 1, name: "Saudi Home Essentials", productCount: 11, sharePct: 0.057 },
    { rank: 2, name: "KitchenPro KSA", productCount: 7, sharePct: 0.036 },
    { rank: 3, name: "FreshLife Store", productCount: 5, sharePct: 0.026 },
  ],

  narrative:
    "Portable Juicer Cups 在 Noon KSA 属于中等竞争市场，FBN 渗透率 72% 高于 UAE，配送体验已是主流预期。斋月后进入夏季饮品旺季，需求窗口清晰。",
};

// ─── Negative variant — iPhone 17 data cable in UAE ────────────

const UAE_IPHONE_CABLE: MarketIntelligence = {
  keyword: "iphone 17 data cable",
  market: "UAE",
  locale: "en-ae",

  independentProductCount: 2800,
  sellerCount: 180,
  priceBand: { min: 10, max: 15, currency: "AED" },
  medianPrice: 12,

  competition: {
    hhi: 0.32,
    top3SellerShare: 0.68,
    reviewBarrier: 220,
    entryDifficulty: "high",
    sponsoredPct: 0.48,
    fbnPct: 0.85,
  },

  priceDistribution: {
    min: 5,
    p25: 10,
    median: 12,
    p75: 15,
    max: 39,
    currency: "AED",
    suggestedPrice: 12,
    suggestionReason: "贴近中位，高端位被 MFi 认证品牌占据，小卖家无溢价空间",
  },

  narrative:
    "iPhone 17 数据线在 Noon UAE 属于高度集中的品牌市场。Anker / Belkin / Baseus 等认证品牌占据 68% 份额，广告位 48% 极度内卷，中位价仅 12 AED。未持 MFi 认证或渠道优势不建议进入。",
};

// ─── Scene → fixture routing ───────────────────────────────────

/**
 * Returns a mock `ToolResponse<MarketIntelligence>` for the given scene.
 * The `latency_ms` in metadata simulates Noon's typical on-demand crawl
 * timing so the UI's "已分析 · 3 个数据源 · 5.2s" label looks real.
 */
export function getMockMarketResponse(scene: SceneId): MarketIntelligenceResponse {
  switch (scene) {
    case "happy":
    case "ask_market":
    case "gather":
      return toolSuccess(UAE_PORTABLE_FAN, {
        latency_ms: 5200,
        data_source: "on_demand",
        data_freshness: NOW_ISO,
        confidence: "medium",
        confidence_note: "基于 150 个搜索结果（3 页）",
        cost: { crawl_bytes: 153_600, db_queries: 3 },
      });

    case "ksa":
      return toolSuccess(KSA_JUICER_CUP, {
        latency_ms: 4800,
        data_source: "on_demand",
        data_freshness: NOW_ISO,
        confidence: "medium",
        confidence_note: "基于 180 个搜索结果（3 页）",
        cost: { crawl_bytes: 171_000, db_queries: 3 },
      });

    case "negative":
      return toolSuccess(UAE_IPHONE_CABLE, {
        latency_ms: 800,
        data_source: "cache",
        data_freshness: NOW_ISO,
        confidence: "high",
        confidence_note: "7 天内缓存命中",
        cost: { crawl_bytes: 0, db_queries: 4 },
      });

    case "degraded":
      // Crawl timed out. We still return a minimal shell so the Agent can
      // reference `keyword` / `market`, but no competition / pricing data.
      return toolPartial<MarketIntelligence>(
        {
          keyword: "pet automatic feeder",
          market: "UAE",
          locale: "en-ae",
        },
        "实时获取超时 >8s，未能取回市场数据",
        {
          latency_ms: 8050,
          data_source: "on_demand",
          confidence: "low",
          cost: { crawl_bytes: 0, db_queries: 2 },
        },
      );
  }
}
