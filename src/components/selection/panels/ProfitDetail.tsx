"use client";

import { useMemo, useState } from "react";
import { InputNumber, Button } from "antd";

import type { SceneId } from "@/lib/selection/mock/scenes";
import { getMockProfitResponse } from "@/lib/selection/mock/profit-data";

import { DPKV, DPSection } from "./_internals";

export interface ProfitDetailProps {
  scene: SceneId;
}

/**
 * Deep profit breakdown + an *investment simulator* that projects
 * total cost, sales, payback period given a first-batch quantity and
 * assumed daily sales. All assumptions (FX, commission, return rate,
 * daily sales estimate) are rendered as an editable "assumptions hint"
 * so users can't miss what's driving the numbers.
 */
export default function ProfitDetail({ scene }: ProfitDetailProps) {
  const response = getMockProfitResponse(scene);
  const profit = response.data;

  // All hooks must run unconditionally — the early-return for missing
  // `profit` goes BELOW these hook declarations. Safe defaults guard
  // the calc from NaN in the null case.
  const defaultDailySales = profit?.assumptions.dailySalesEstimate ?? 5;
  const [qty, setQty] = useState<number>(200);
  const [daily, setDaily] = useState<number>(defaultDailySales);

  const sim = useMemo(() => {
    if (!profit) {
      return null;
    }
    const purchaseTotalRmb = qty * profit.purchaseCostRmb;
    // Look up by semantic category (stable) rather than Chinese label (volatile).
    const freightLine = profit.breakdown.find((l) => l.category === "freight");
    const freightPerUnit = freightLine?.amount ?? 0;
    const freightTotalLocal = freightPerUnit * qty;
    const freightTotalRmb = freightTotalLocal / profit.assumptions.fxRate;
    const totalInvestRmb = purchaseTotalRmb + freightTotalRmb;

    const salesLocal = qty * profit.suggestedPrice;
    const profitLocal = qty * profit.netProfitPerUnit;
    const profitRmb = profitLocal / profit.assumptions.fxRate;

    const weeks = qty / Math.max(1, daily) / 7;
    const weeksLow = weeks * 0.85;
    const weeksHigh = weeks * 1.15;

    return {
      purchaseTotalRmb,
      freightTotalRmb,
      totalInvestRmb,
      salesLocal,
      profitLocal,
      profitRmb,
      weeksLow,
      weeksHigh,
    };
  }, [qty, daily, profit]);

  if (!profit || !sim) {
    return (
      <p className="text-[13px] text-[var(--ink3)]">
        此场景没有利润数据。
      </p>
    );
  }

  const { assumptions } = profit;

  return (
    <>
      <DPSection title="详细成本结构">
        {profit.breakdown.map((line) => (
          <DPKV
            key={line.label}
            label={
              <>
                {line.label}
                {line.note && (
                  <span className="ml-1 text-[11px] text-[var(--ink4)]">
                    ({line.note})
                  </span>
                )}
              </>
            }
            value={
              line.kind === "memo"
                ? String(line.amount || "待确认")
                : `${line.kind === "revenue" ? "" : "-"}${line.amount.toFixed(2)} ${profit.currency}`
            }
            note={`${(line.pctOfRevenue * 100).toFixed(1)}%`}
            tone={line.kind === "deduction" ? "negative" : line.kind === "revenue" ? "strong" : "default"}
          />
        ))}
        <div className="mt-2 border-t-2 border-[var(--ink)] pt-2">
          <DPKV
            label={<span className="font-bold">净利润</span>}
            value={`${profit.netProfitPerUnit.toFixed(2)} ${profit.currency}`}
            tone="positive"
          />
        </div>
      </DPSection>

      <DPSection title="关键指标">
        <DPKV
          label="利润率"
          value={`${(profit.marginPct * 100).toFixed(1)}%`}
          tone={profit.marginPct > 0.25 ? "positive" : profit.marginPct > 0 ? "default" : "negative"}
        />
        <DPKV
          label="投资回报率 (ROI)"
          value={`${(profit.roiPct * 100).toFixed(0)}%`}
          tone={profit.roiPct > 0.5 ? "positive" : "default"}
        />
        <DPKV
          label="每单成本"
          value={`${profit.totalCostPerUnit.toFixed(2)} ${profit.currency}`}
        />
        <DPKV
          label="每单净利"
          value={`${profit.netProfitPerUnit.toFixed(2)} ${profit.currency}`}
          tone={profit.netProfitPerUnit > 0 ? "positive" : "negative"}
        />
      </DPSection>

      <DPSection title="投资模拟">
        <AssumptionsHint
          fxRate={assumptions.fxRate}
          commissionRate={assumptions.commissionRate}
          returnRate={assumptions.returnRate}
        />

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px]">
            <span className="min-w-[64px] font-medium text-[var(--ink2)]">首批数量</span>
            <InputNumber
              min={50}
              step={50}
              value={qty}
              onChange={(v) => v && setQty(v)}
              size="small"
              style={{ width: 100 }}
            />
            <span className="text-[12px] text-[var(--ink3)]">件</span>
          </label>
          <div className="flex gap-1">
            {[100, 200, 500, 1000].map((n) => (
              <Button
                key={n}
                size="small"
                type={qty === n ? "primary" : "default"}
                onClick={() => setQty(n)}
                className="!text-[11px]"
              >
                {n}
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <label className="flex items-center gap-2 text-[13px]">
            <span className="min-w-[64px] font-medium text-[var(--ink2)]">日均销量</span>
            <InputNumber
              min={1}
              step={1}
              value={daily}
              onChange={(v) => v && setDaily(v)}
              size="small"
              style={{ width: 100 }}
            />
            <span className="text-[12px] text-[var(--ink3)]">单/天</span>
          </label>
          <span className="text-[11px] text-[var(--ink4)]">· 影响回本周期</span>
        </div>

        <DPKV
          label="采购总成本"
          value={`¥${formatCny(sim.purchaseTotalRmb)}`}
          note={`${qty} × ¥${profit.purchaseCostRmb}`}
        />
        <DPKV
          label="头程物流"
          value={`¥${formatCny(sim.freightTotalRmb)}`}
        />
        <DPKV
          label={<span className="font-bold">总投入</span>}
          value={`¥${formatCny(sim.totalInvestRmb)}`}
          tone="strong"
        />
        <DPKV
          label="预期总销售"
          value={`${formatCny(sim.salesLocal)} ${profit.currency}`}
        />
        <DPKV
          label="预期总利润"
          value={`${formatCny(sim.profitLocal)} ${profit.currency}`}
          note={`≈ ¥${formatCny(sim.profitRmb)}`}
          tone="positive"
        />
        <DPKV
          label="回本周期"
          value={`约 ${sim.weeksLow.toFixed(1)}–${sim.weeksHigh.toFixed(1)} 周`}
          note={`基于日均 ${daily} 单`}
        />
      </DPSection>

      <DPSection title="费率说明">
        <ul className="list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-[var(--ink3)]">
          <li>
            佣金费率基于 Noon {profit.market} 电商品类 {(assumptions.commissionRate * 100).toFixed(0)}%，实际可能因子类目略有差异
          </li>
          <li>FBN 费用按小件商品（&lt;0.5kg）计算</li>
          <li>
            汇率 1 CNY = {assumptions.fxRate} {profit.currency}，实际波动 ±{(assumptions.fxRateTolerance * 100).toFixed(0)}%
          </li>
          <li>VAT 处理机制待对照 Statement Report 确认</li>
        </ul>
      </DPSection>
    </>
  );
}

function AssumptionsHint({
  fxRate,
  commissionRate,
  returnRate,
}: {
  fxRate: number;
  commissionRate: number;
  returnRate: number;
}) {
  return (
    <div className="mb-3 rounded-md bg-stone-50 p-2.5 text-[11px] leading-relaxed text-[var(--ink3)]">
      <span className="font-semibold text-[var(--ink2)]">模拟假设：</span>
      <span> 汇率 1 CNY = {fxRate} · 佣金 {(commissionRate * 100).toFixed(0)}% · 退货率 {(returnRate * 100).toFixed(0)}% · 日均销量可下方调整</span>
    </div>
  );
}

function formatCny(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
