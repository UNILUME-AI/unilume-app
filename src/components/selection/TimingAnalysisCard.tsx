"use client";

import { RightOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import type { TimingIntelResponse, Relevance } from "@/lib/selection/mock/types";

export interface TimingAnalysisCardProps {
  response: TimingIntelResponse;
  onOpenDetail?: () => void;
}

/**
 * Overview card for `timing_intelligence`. Shows the current phase, the
 * next 2-3 most-relevant events, and a one-liner outlook sentence.
 */
export default function TimingAnalysisCard({
  response,
  onOpenDetail,
}: TimingAnalysisCardProps) {
  const data = response.data;
  const isInteractive = response.status !== "error" && data !== null && onOpenDetail !== undefined;

  if (!data) {
    return (
      <section
        className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm"
        aria-label="时机判断"
      >
        <CardHeader title="时机判断" />
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink3)]">
          {response.metadata.degradation_reason ?? "未能取回时机数据。"}
        </p>
      </section>
    );
  }

  // Highlight next 3 events with relevance > "none"
  const upcoming = data.events
    .filter((e) => e.relevance !== "none")
    .slice(0, 3);

  return (
    <button
      type="button"
      onClick={isInteractive ? onOpenDetail : undefined}
      disabled={!isInteractive}
      className={[
        "group w-full rounded-xl border border-[var(--border)] bg-white p-4 text-left shadow-sm transition-all",
        isInteractive ? "cursor-pointer hover:-translate-y-px hover:shadow-md hover:border-[var(--border-hover)]" : "cursor-default",
      ].join(" ")}
      aria-label="时机判断 · 点击查看完整事件日历"
    >
      <CardHeader title="时机判断" />

      <p className="mt-1 text-[13px] font-semibold leading-tight text-[var(--ink)]">
        当前时段：{data.currentPhase.name} · {data.currentPhase.demandLevel}
      </p>

      <div className="my-3 space-y-1.5">
        {upcoming.map((ev) => {
          const { label, color } = RELEVANCE_TOKENS[ev.relevance];
          return (
            <div
              key={ev.name}
              className="flex items-center gap-2 text-[13px]"
            >
              <span className="min-w-[90px] font-medium text-[var(--ink)]">
                {ev.name}
              </span>
              <span className="min-w-[60px] text-[var(--ink3)]">{ev.date}</span>
              <Tag color={color} className="!mr-0 !text-[10px]">
                {label}
              </Tag>
            </div>
          );
        })}
        {data.stockCutoff && (
          <div className="flex items-center gap-2 text-[13px]">
            <span className="min-w-[90px] font-medium text-[var(--ink)]">
              {data.stockCutoff.label}
            </span>
            <span className="min-w-[60px] text-[var(--ink3)]">{data.stockCutoff.date}</span>
            <Tag color="blue" className="!mr-0 !text-[10px]">
              FBN 入仓建议
            </Tag>
          </div>
        )}
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink2)]">
        <span className="font-semibold text-[var(--ink2)]">需求展望：</span>
        {data.outlook.days30.detail}，{data.outlook.days90.label}
        {data.outlook.riskWindow.label !== "暂无明显风险窗口" && (
          <span className="text-amber-700"> — {data.outlook.riskWindow.label}{data.outlook.riskWindow.detail ? `，${data.outlook.riskWindow.detail}` : ""}</span>
        )}
      </p>

      {isInteractive && (
        <div className="mt-3 flex items-center justify-center gap-1 border-t border-[var(--border)] pt-2 text-[12px] text-[var(--ink4)] transition-colors group-hover:text-[var(--brand)]">
          点击查看全年事件日历 · 需求展望
          <RightOutlined className="text-[10px]" />
        </div>
      )}
    </button>
  );
}

// ─── Internal ─────────────────────────────────────────────────

function CardHeader({ title }: { title: string }) {
  return (
    <h3 className="text-[15px] font-bold tracking-tight text-[var(--ink)]">
      {title}
    </h3>
  );
}

const RELEVANCE_TOKENS: Record<Relevance, { label: string; color: string }> = {
  high: { label: "高度相关", color: "red" },
  mid: { label: "中度相关", color: "orange" },
  low: { label: "低相关", color: "blue" },
  none: { label: "季节错配", color: "default" },
};
