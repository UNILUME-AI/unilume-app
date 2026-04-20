"use client";

import { useMemo, useState } from "react";
import { Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

import type { ProfitCalc } from "@/lib/selection/mock/types";
import { calculateProfit, type ProfitInputs } from "@/lib/selection/mock/profit-data";

export interface PriceCompareProps {
  /** The agent-recommended ProfitCalc anchor. Used as the reset target. */
  anchor: ProfitCalc;
}

/**
 * Live "what-if" pricing card. Starts at the agent's recommended price
 * and lets the user edit — margin/net/ROI and a strategy label update on
 * every keystroke. When the value differs from the anchor, the card
 * shifts to a muted "modified" state and the reset button appears.
 *
 * This is the only Phase 1/2 component that does live recomputation,
 * and it does it via `calculateProfit()` — the same pure function that
 * produced the anchor. When #111 lands, both callers switch to the real
 * tool in a single import change.
 */
export default function PriceCompare({ anchor }: PriceCompareProps) {
  const [price, setPrice] = useState<number>(anchor.suggestedPrice);

  const isAnchor = price === anchor.suggestedPrice;

  // Rebuild ProfitInputs from anchor so we can re-run calculateProfit
  // with the user-edited price. Freight cost is the last deduction line
  // matching label "头程运费".
  const inputs: ProfitInputs = useMemo(() => {
    const freightLine = anchor.breakdown.find((l) => l.label === "头程运费");
    return {
      market: anchor.market,
      currency: anchor.currency,
      suggestedPrice: price,
      purchaseCostRmb: anchor.purchaseCostRmb,
      freightCostLocal: freightLine?.amount ?? 0,
      assumptions: anchor.assumptions,
    };
  }, [anchor, price]);

  const live = useMemo(() => calculateProfit(inputs), [inputs]);

  const marginTone = classifyMargin(live.marginPct);
  const delta = price - anchor.suggestedPrice;
  const deltaPct = anchor.suggestedPrice > 0
    ? (delta / anchor.suggestedPrice) * 100
    : 0;

  return (
    <div className="my-3">
      {/* Header — title + reset */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-[14px] font-bold tracking-tight text-[var(--ink)]">
          定价模拟
        </h4>
        {!isAnchor && (
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => setPrice(anchor.suggestedPrice)}
            aria-label="重置为建议价"
            className="!text-[11px]"
          >
            重置为建议价
          </Button>
        )}
      </div>

      {/* Main card */}
      <div
        className={[
          "rounded-xl p-4 transition-colors",
          isAnchor
            ? "border-[1.5px] border-[var(--brand)] bg-[var(--brand-soft)] shadow-[0_0_0_1px_var(--brand-glow)]"
            : "border border-[var(--border-hover)] bg-[color-mix(in_srgb,var(--ink)_2%,transparent)]",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: tag + editable price + delta/reason */}
          <div className="flex flex-col gap-1">
            <span
              className={`text-[10px] font-bold uppercase tracking-widest ${
                isAnchor ? "text-[var(--brand)]" : "text-[var(--ink3)]"
              }`}
            >
              {isAnchor ? "Agent 建议" : "你的试算"}
            </span>
            <div className="flex items-baseline gap-1.5">
              <input
                type="number"
                min={1}
                step={1}
                value={price}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) setPrice(v);
                }}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="试算售价"
                className="w-[90px] border-0 border-b-[1.5px] border-dashed border-[var(--ink4)] bg-transparent p-0 text-[26px] font-bold tabular-nums tracking-tight text-[var(--ink)] outline-none transition-colors hover:border-[var(--brand)] focus:border-solid focus:border-[var(--brand)]"
              />
              <span className="text-[14px] font-medium text-[var(--ink3)]">
                {anchor.currency}
              </span>
            </div>
            {isAnchor ? (
              <div className="mt-1 text-[12px] tabular-nums text-[var(--ink3)]">
                建议锚定价 · 利润率健康 + 贴近市场中位
              </div>
            ) : (
              <div className="mt-1 text-[12px] tabular-nums text-[var(--ink3)]">
                <span
                  className={
                    delta < 0
                      ? "font-semibold text-blue-600"
                      : "font-semibold text-purple-600"
                  }
                >
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(0)} {anchor.currency} ({deltaPct >= 0 ? "+" : ""}
                  {deltaPct.toFixed(1)}%)
                </span>
                <span className="ml-1.5 text-[var(--ink3)]">
                  · {classifyStrategy(delta, anchor.suggestedPrice)}
                </span>
              </div>
            )}
          </div>

          {/* Right: margin + net */}
          <div className="flex gap-5">
            <Metric
              value={`${(live.marginPct * 100).toFixed(1)}%`}
              label="利润率"
              tone={marginTone}
            />
            <Metric
              value={`${live.netProfitPerUnit.toFixed(2)} ${anchor.currency}`}
              label="每单净利"
              tone={marginTone}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────

type Tone = "positive" | "warn" | "negative";

function classifyMargin(marginPct: number): Tone {
  if (marginPct < 0) return "negative";
  if (marginPct < 0.25) return "warn";
  return "positive";
}

function classifyStrategy(delta: number, anchor: number): string {
  const ratio = delta / anchor;
  if (ratio <= -0.15) return "低端抢量";
  if (ratio < -0.05) return "小幅让利";
  if (ratio <= 0.05) return "贴近建议";
  if (ratio <= 0.2) return "溢价尝试";
  return "高端定位";
}

function Metric({ value, label, tone }: { value: string; label: string; tone: Tone }) {
  const valueClass =
    tone === "negative"
      ? "text-red-600"
      : tone === "warn"
        ? "text-amber-600"
        : "text-emerald-600";
  return (
    <div className="text-right">
      <div className={`text-[18px] font-bold tabular-nums tracking-tight ${valueClass}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-[var(--ink3)]">{label}</div>
    </div>
  );
}

