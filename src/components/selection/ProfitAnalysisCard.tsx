"use client";

import { RightOutlined } from "@ant-design/icons";
import type { ProfitCalcResponse } from "@/lib/selection/mock/types";
import PriceCompare from "./PriceCompare";

export interface ProfitAnalysisCardProps {
  response: ProfitCalcResponse;
  onOpenDetail?: () => void;
}

/**
 * Overview card for `profit_calculator`. Shows the profit breakdown
 * (revenue → deductions → net) + margin & ROI chips. Embeds
 * <PriceCompare> so users can tweak the sale price and see margin
 * move in real time, without needing to open the detail panel.
 *
 * The PriceCompare interaction zone swallows clicks to prevent the
 * parent card's onClick (drill) from firing when the user is editing.
 */
export default function ProfitAnalysisCard({
  response,
  onOpenDetail,
}: ProfitAnalysisCardProps) {
  const profit = response.data;
  const isInteractive = response.status !== "error" && profit !== null && onOpenDetail !== undefined;

  if (!profit) {
    return (
      <section
        className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm"
        aria-label="利润拆解"
      >
        <CardHeader title="利润拆解" />
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink3)]">
          {response.metadata.degradation_reason ?? "未能计算利润。"}
        </p>
      </section>
    );
  }

  return (
    <section
      className={[
        "rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm transition-all",
        isInteractive ? "hover:shadow-md hover:border-[var(--border-hover)]" : "",
      ].join(" ")}
      aria-label="利润拆解"
    >
      <CardHeader title="利润拆解" />

      <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink2)]">
        <strong>建议定价 {profit.suggestedPrice} {profit.currency}</strong>
        {" — 综合考虑市场中位价和差异化空间"}
      </p>

      {/* Profit line breakdown */}
      <div className="my-3 space-y-0.5">
        {profit.breakdown
          .filter((l) => l.kind !== "memo")
          .map((line) => (
            <div
              key={line.label}
              className="flex items-baseline justify-between text-[13px]"
            >
              <span className="text-[var(--ink2)]">
                {line.label}
                {line.note && (
                  <span className="ml-1 text-[11px] text-[var(--ink4)]">
                    ({line.note})
                  </span>
                )}
              </span>
              <span
                className={[
                  "font-semibold tabular-nums",
                  line.kind === "deduction" ? "text-red-600" : "text-[var(--ink)]",
                ].join(" ")}
              >
                {line.kind === "deduction" ? "-" : ""}
                {line.amount.toFixed(2)} {profit.currency}
              </span>
            </div>
          ))}
        <div className="mt-1 flex items-baseline justify-between border-t border-[var(--ink)] pt-2 text-[14px]">
          <span className="font-bold">
            净利润
            <span className="ml-1 text-[11px] font-normal text-[var(--ink4)]">
              (未含 VAT)
            </span>
          </span>
          <span className="text-[16px] font-bold tabular-nums text-emerald-600">
            {profit.netProfitPerUnit.toFixed(2)} {profit.currency}
          </span>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2">
        <Chip tone={profit.marginPct > 0.25 ? "positive" : profit.marginPct > 0 ? "warn" : "negative"}>
          利润率 {(profit.marginPct * 100).toFixed(1)}%
        </Chip>
        <Chip tone={profit.roiPct > 0.5 ? "positive" : "default"}>
          ROI {(profit.roiPct * 100).toFixed(0)}%
        </Chip>
      </div>

      {/* Interactive PriceCompare */}
      <div className="mt-1" onClick={(e) => e.stopPropagation()}>
        <PriceCompare anchor={profit} />
      </div>

      {isInteractive && (
        <button
          type="button"
          onClick={onOpenDetail}
          className="mt-3 flex w-full items-center justify-center gap-1 border-t border-[var(--border)] pt-2 text-[12px] text-[var(--ink4)] transition-colors hover:text-[var(--brand)]"
        >
          点击查看费率明细 · 投资模拟 · 汇率说明
          <RightOutlined className="text-[10px]" />
        </button>
      )}
    </section>
  );
}

// ─── Subcomponents ────────────────────────────────────────────

function CardHeader({ title }: { title: string }) {
  return (
    <h3 className="text-[15px] font-bold tracking-tight text-[var(--ink)]">
      {title}
    </h3>
  );
}

function Chip({
  tone,
  children,
}: {
  tone: "positive" | "warn" | "negative" | "default";
  children: React.ReactNode;
}) {
  const classes: Record<typeof tone, string> = {
    positive: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    negative: "bg-red-50 text-red-700",
    default: "bg-stone-100 text-[var(--ink2)]",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2.5 py-0.5 text-[12px] font-semibold ${classes[tone]}`}
    >
      {children}
    </span>
  );
}
