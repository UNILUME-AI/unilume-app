"use client";

import { Button } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import type { VerdictTone } from "@/lib/selection/mock/scenes";

export interface VerdictHeaderProps {
  tone: VerdictTone;
  /** Chip label — "建议进入" / "建议谨慎" / "建议观望" */
  recommendLabel: string;
  /** 1-2 sentence summary in the big area. */
  summary: string;
  /** Open the Basis detail panel. Omit to hide the button. */
  onOpenBasis?: () => void;
}

/**
 * Verdict header — the "top of the analysis" band. Its left border and
 * tag color encode the tone, and the summary copy is the single most
 * important piece of text in the whole selection experience.
 */
export default function VerdictHeader({
  tone,
  recommendLabel,
  summary,
  onOpenBasis,
}: VerdictHeaderProps) {
  const tokens = TONE_TOKENS[tone];

  return (
    <div
      className={`rounded-xl border bg-white p-4 border-l-[3px] ${tokens.border} ${tokens.borderLeft} shadow-sm`}
      role="region"
      aria-label="Agent 综合结论"
    >
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${tokens.chipBg} ${tokens.chipText}`}
      >
        {recommendLabel}
      </span>
      <p className="mt-2 text-[15px] font-medium leading-relaxed text-[var(--ink)]">
        {summary}
      </p>
      {onOpenBasis && (
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="text"
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={onOpenBasis}
            aria-label="查看建议依据"
          >
            查看依据
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Visual tokens per tone. Kept in a const map (not inline className) so
 * Tailwind's JIT picks up all three color combinations at build time.
 */
const TONE_TOKENS: Record<
  VerdictTone,
  {
    border: string;
    borderLeft: string;
    chipBg: string;
    chipText: string;
  }
> = {
  positive: {
    border: "border-[var(--border)]",
    borderLeft: "border-l-emerald-500",
    chipBg: "bg-emerald-50",
    chipText: "text-emerald-700",
  },
  risky: {
    border: "border-[var(--border)]",
    borderLeft: "border-l-amber-500",
    chipBg: "bg-amber-50",
    chipText: "text-amber-700",
  },
  negative: {
    border: "border-[var(--border)]",
    borderLeft: "border-l-red-500",
    chipBg: "bg-red-50",
    chipText: "text-red-700",
  },
};
