/**
 * Mock `profit_calculator` tool responses for the 6 demo scenes.
 *
 * Unlike `market-data.ts` (static dashboard numbers), profit fixtures are
 * **derived** from a small set of inputs (sale price + purchase cost +
 * fee schedule). We keep the derivation visible so that:
 *
 *   1. Changing a single fee rate propagates to all scenes consistently.
 *   2. The mock closely mirrors the eventual real `profit_calculator`
 *      implementation — the tool's internals will literally be this
 *      `calculateProfit(...)` function, promoted to `lib/selection/profit.ts`.
 *
 * TODO(#111): When `profit_calculator` tool lands, replace this file's
 * `calculateProfit` with the one reading from `noon-fee-schedule.json`.
 */

import type { SceneId } from "./scenes";
import {
  toolSuccess,
  toolPartial,
  type Currency,
  type Market,
  type ProfitAssumptions,
  type ProfitCalc,
  type ProfitCalcResponse,
  type ProfitLine,
} from "./types";

// ─── Fee schedule (placeholder — real source in #111) ──────────

/**
 * UAE fee schedule for electronics / small-appliance categories.
 * Source: prototype + to-be-confirmed Noon Statement Report.
 */
const UAE_FEES: ProfitAssumptions = {
  commissionRate: 0.15,
  fbnFee: 5.5,
  fxRate: 0.51,
  fxRateTolerance: 0.02,
  returnRate: 0.04,
  dailySalesEstimate: 5,
};

const KSA_FEES: ProfitAssumptions = {
  commissionRate: 0.13,    // KSA often 1-2pp lower than UAE for home goods
  fbnFee: 6.0,
  fxRate: 0.52,
  fxRateTolerance: 0.02,
  returnRate: 0.05,
  dailySalesEstimate: 4,
};

// ─── Core calculation ──────────────────────────────────────────

export interface ProfitInputs {
  market: Market;
  currency: Currency;
  suggestedPrice: number;
  purchaseCostRmb: number;
  freightCostLocal: number;   // inbound shipping in market currency
  assumptions: ProfitAssumptions;
}

/**
 * Produces the full ProfitCalc object from raw inputs.
 * Pure function — no I/O, no randomness — safe to snapshot-test.
 *
 * Exported for use by `PriceCompare.tsx` (live what-if recalc) and tests.
 * In #111 this function gets lifted to `lib/selection/profit.ts`.
 */
export function calculateProfit(inputs: ProfitInputs): ProfitCalc {
  const { market, currency, suggestedPrice, purchaseCostRmb, freightCostLocal, assumptions } = inputs;

  const purchaseCostLocal = purchaseCostRmb * assumptions.fxRate;
  const commission = suggestedPrice * assumptions.commissionRate;
  const returnReserve = suggestedPrice * assumptions.returnRate;

  const totalCost =
    commission +
    assumptions.fbnFee +
    purchaseCostLocal +
    freightCostLocal +
    returnReserve;

  const netProfit = suggestedPrice - totalCost;
  const margin = suggestedPrice > 0 ? netProfit / suggestedPrice : 0;
  const roi = totalCost > 0 ? netProfit / totalCost : 0;

  const breakdown: ProfitLine[] = [
    {
      category: "sale_price",
      label: "售价",
      amount: suggestedPrice,
      pctOfRevenue: 1,
      kind: "revenue",
    },
    {
      category: "commission",
      label: "销售佣金",
      note: `${(assumptions.commissionRate * 100).toFixed(0)}%`,
      amount: commission,
      pctOfRevenue: assumptions.commissionRate,
      kind: "deduction",
    },
    {
      category: "fbn_fee",
      label: "FBN 物流费",
      amount: assumptions.fbnFee,
      pctOfRevenue: assumptions.fbnFee / suggestedPrice,
      kind: "deduction",
    },
    {
      category: "purchase",
      label: "采购成本",
      note: `¥${purchaseCostRmb} × ${assumptions.fxRate}`,
      amount: purchaseCostLocal,
      pctOfRevenue: purchaseCostLocal / suggestedPrice,
      kind: "deduction",
    },
    {
      category: "freight",
      label: "头程运费",
      note: "0.5kg 海运",
      amount: freightCostLocal,
      pctOfRevenue: freightCostLocal / suggestedPrice,
      kind: "deduction",
    },
    {
      category: "return",
      label: "退货分摊",
      note: `${(assumptions.returnRate * 100).toFixed(0)}%`,
      amount: returnReserve,
      pctOfRevenue: assumptions.returnRate,
      kind: "deduction",
    },
    {
      category: "vat",
      label: "VAT",
      note: "待确认",
      amount: 0,
      pctOfRevenue: 0,
      kind: "memo",
    },
  ];

  return {
    market,
    currency,
    suggestedPrice,
    purchaseCostRmb,
    netProfitPerUnit: Math.round(netProfit * 100) / 100,
    marginPct: Math.round(margin * 1000) / 1000,
    roiPct: Math.round(roi * 100) / 100,
    totalCostPerUnit: Math.round(totalCost * 100) / 100,
    breakdown,
    assumptions,
  };
}

// ─── Scene inputs ──────────────────────────────────────────────

const UAE_FAN_INPUTS: ProfitInputs = {
  market: "UAE",
  currency: "AED",
  suggestedPrice: 69,
  purchaseCostRmb: 35,
  freightCostLocal: 4.59,
  assumptions: UAE_FEES,
};

const KSA_JUICER_INPUTS: ProfitInputs = {
  market: "KSA",
  currency: "SAR",
  suggestedPrice: 109,
  purchaseCostRmb: 48,
  freightCostLocal: 5.8,
  assumptions: KSA_FEES,
};

const UAE_DEGRADED_INPUTS: ProfitInputs = {
  market: "UAE",
  currency: "AED",
  // Pet feeder — no market data, so price is a rough guess from category
  // median. We still run the calc so the UI can show *some* margin estimate.
  suggestedPrice: 155,
  purchaseCostRmb: 85,
  freightCostLocal: 7.2,   // heavier item
  assumptions: UAE_FEES,
};

const UAE_IPHONE_CABLE_INPUTS: ProfitInputs = {
  market: "UAE",
  currency: "AED",
  suggestedPrice: 12,
  purchaseCostRmb: 6,
  freightCostLocal: 1.5,
  assumptions: UAE_FEES,
};

// ─── Scene → fixture routing ───────────────────────────────────

/**
 * Returns a mock `ToolResponse<ProfitCalc>` for the given scene.
 * Degraded scene still gets full profit math — only market data is missing.
 */
export function getMockProfitResponse(scene: SceneId): ProfitCalcResponse {
  const commonMeta = {
    data_source: "static" as const,
    confidence: "high" as const,
    confidence_note: "基于 Noon 2026 官方费率表",
    cost: { db_queries: 0 },
  };

  switch (scene) {
    case "happy":
    case "ask_market":
    case "gather":
      return toolSuccess(calculateProfit(UAE_FAN_INPUTS), {
        latency_ms: 120,
        ...commonMeta,
      });

    case "ksa":
      return toolSuccess(calculateProfit(KSA_JUICER_INPUTS), {
        latency_ms: 130,
        ...commonMeta,
      });

    case "degraded":
      // Confidence lowered: price anchor is weak without market data.
      return toolPartial(
        calculateProfit(UAE_DEGRADED_INPUTS),
        "价格锚定缺失市场数据，利润率为按品类均值估算",
        {
          latency_ms: 110,
          data_source: "static",
          confidence: "low",
          cost: { db_queries: 0 },
        },
      );

    case "negative":
      return toolSuccess(calculateProfit(UAE_IPHONE_CABLE_INPUTS), {
        latency_ms: 95,
        ...commonMeta,
      });
  }
}
