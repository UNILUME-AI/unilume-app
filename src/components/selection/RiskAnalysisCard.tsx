"use client";

import type { RiskItem } from "@/lib/selection/mock/types";

export interface RiskAnalysisCardProps {
  risks: RiskItem[];
}

/**
 * Static risk list card. Always rendered (any serious conclusion has
 * risks). Non-interactive — users who want more context click the
 * "查看依据" button next to the Verdict header.
 */
export default function RiskAnalysisCard({ risks }: RiskAnalysisCardProps) {
  if (risks.length === 0) {
    return null;
  }

  return (
    <section
      className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm"
      aria-label="风险提示"
    >
      <h3 className="text-[15px] font-bold tracking-tight text-[var(--ink)]">
        风险提示
      </h3>
      <ul className="mt-2 space-y-1.5">
        {risks.map((r, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--ink2)]"
          >
            <span className={`mt-[2px] flex-shrink-0 ${BULLET_CLASS[r.severity]}`} aria-hidden>
              ●
            </span>
            <span>
              <strong className="font-semibold text-[var(--ink)]">
                {r.title}
              </strong>
              ：{r.detail}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const BULLET_CLASS: Record<RiskItem["severity"], string> = {
  info: "text-blue-500",
  warn: "text-amber-500",
  alert: "text-red-500",
};
