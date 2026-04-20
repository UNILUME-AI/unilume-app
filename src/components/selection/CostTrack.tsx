"use client";

import type { SceneUIState } from "@/lib/selection/mock/ui-state";

export interface CostTrackProps {
  cost: SceneUIState["cost"];
}

/**
 * Inline footer showing query cost breakdown (LLM / data / DB / total).
 * Render below the analysis cards. Dashed top-border mimics a "receipt".
 *
 * Intentionally low visual priority — users glance at it for audit /
 * transparency but shouldn't be distracted.
 */
export default function CostTrack({ cost }: CostTrackProps) {
  const items: Array<[string, string]> = [
    ["LLM", cost.llmTokens],
    ["数据源", cost.dataPayload],
    ["DB", `${cost.dbQueries} queries`],
    ["总计", cost.totalUsd],
  ];

  return (
    <dl
      className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-dashed border-[var(--border)] pt-2 text-[11px] tabular-nums text-[var(--ink3)]"
      aria-label="本次查询成本"
    >
      {items.map(([label, value]) => (
        <div key={label} className="flex items-center gap-1">
          <dt className="font-semibold text-[var(--ink2)]">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
