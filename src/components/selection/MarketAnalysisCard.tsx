"use client";

import { RightOutlined } from "@ant-design/icons";
import type { MarketIntelligenceResponse } from "@/lib/selection/mock/types";

export interface MarketAnalysisCardProps {
  response: MarketIntelligenceResponse;
  onOpenDetail?: () => void;
}

/**
 * Overview card for `market_intelligence`. Shows 3–6 KPIs and a narrative
 * sentence, plus a drill-hint footer that opens the full MarketDetail
 * panel when clicked.
 *
 * If the response is partial/error, renders a compact "data unavailable"
 * state rather than hiding — users should always know the market card
 * was attempted.
 */
export default function MarketAnalysisCard({
  response,
  onOpenDetail,
}: MarketAnalysisCardProps) {
  const data = response.data;
  const isInteractive = response.status === "success" && onOpenDetail !== undefined;

  if (!data || response.status === "error" || response.status === "not_found") {
    return (
      <section
        className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm"
        aria-label="市场分析"
      >
        <CardHeader title="市场分析" />
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink3)]">
          {response.metadata.degradation_reason ?? "未能取回市场数据。"}
        </p>
      </section>
    );
  }

  return (
    <button
      type="button"
      onClick={isInteractive ? onOpenDetail : undefined}
      disabled={!isInteractive}
      className={[
        "group w-full rounded-xl border border-[var(--border)] bg-white p-4 text-left shadow-sm transition-all",
        isInteractive ? "cursor-pointer hover:-translate-y-px hover:shadow-md hover:border-[var(--border-hover)]" : "cursor-default",
      ].join(" ")}
      aria-label="市场分析 · 点击查看完整数据"
    >
      <CardHeader title="市场分析" />

      <div className="my-3 grid grid-cols-3 gap-3">
        {data.independentProductCount !== undefined && (
          <KPI value={`约 ${data.independentProductCount}`} label="独立产品" />
        )}
        {data.sellerCount !== undefined && (
          <KPI value={`约 ${data.sellerCount}`} label="卖家" />
        )}
        {data.priceBand && (
          <KPI
            value={`${data.priceBand.min}–${data.priceBand.max}`}
            label={`主流价格带 (${data.priceBand.currency})`}
          />
        )}
        {data.medianPrice !== undefined && (
          <KPI value={`${data.medianPrice}`} label="中位价" tone="brand" />
        )}
        {data.competition && (
          <>
            <KPI
              value={`${data.competition.reviewBarrier} 条`}
              label="评论壁垒"
              hint="新品需追赶的评论数"
            />
            <KPI
              value={data.competition.hhi.toFixed(2)}
              label="HHI 指数"
              hint="<0.10 为分散市场"
            />
          </>
        )}
      </div>

      {data.narrative && (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink2)]">
          {data.narrative}
        </p>
      )}

      {isInteractive && (
        <DrillHint text="点击查看完整市场数据 · 竞品列表 · 卖家分布" />
      )}
    </button>
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

function KPI({
  value,
  label,
  hint,
  tone = "default",
}: {
  value: string;
  label: string;
  hint?: string;
  tone?: "default" | "brand";
}) {
  const valueClass =
    tone === "brand"
      ? "text-[var(--brand)]"
      : "text-[var(--ink)]";
  return (
    <div className="text-center">
      <div className={`text-[20px] font-bold leading-tight tabular-nums tracking-tight ${valueClass}`}>
        {value}
      </div>
      <div className="mt-1 text-[12px] font-medium text-[var(--ink3)]" title={hint}>
        {label}
      </div>
    </div>
  );
}

function DrillHint({ text }: { text: string }) {
  return (
    <div className="mt-3 flex items-center justify-center gap-1 border-t border-[var(--border)] pt-2 text-[12px] text-[var(--ink4)] transition-colors group-hover:text-[var(--brand)]">
      {text}
      <RightOutlined className="text-[10px]" />
    </div>
  );
}
