"use client";

import type { ReactNode } from "react";

/** Color class for a zone segment. */
export type ZoneColor = "low" | "mid" | "high" | "info-a" | "info-b" | "info-c";

export interface Zone {
  /** Width as a fraction of the total (e.g. 0.2 → 20%). */
  fraction: number;
  color: ZoneColor;
}

export interface ZonedStatBarProps {
  label: string;
  /** Value as a percentage (0–100). Marker drawn at this position. */
  value: number;
  /** Compact right-side tag, e.g. { text: "中等", kind: "mid" }. */
  tag?: { text: string; kind: "low" | "mid" | "high" | "info" };
  /** Zone segments — must sum to ~1.0 (will be normalized if not). */
  zones: Zone[];
  /** Optional tick labels below the bar (aligned to zone boundaries). */
  ticks?: string[];
  /** Supplementary explanation under the bar. */
  note?: ReactNode;
}

/**
 * A horizontal bar split into colored zones with a vertical marker at
 * `value`. Used for metrics with qualitative interpretation — e.g. ad
 * saturation, FBN penetration — where "what zone am I in?" matters more
 * than "what's the raw number".
 */
export default function ZonedStatBar({
  label,
  value,
  tag,
  zones,
  ticks,
  note,
}: ZonedStatBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className="my-3">
      {/* Header row — label + number + tag */}
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[13px] font-medium text-[var(--ink2)]">{label}</div>
        <div className="flex items-center gap-2">
          <div className="text-[14px] font-bold tabular-nums text-[var(--ink)]">
            {clampedValue}%
          </div>
          {tag && (
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${TAG_TOKENS[tag.kind]}`}
            >
              {tag.text}
            </span>
          )}
        </div>
      </div>

      {/* Track — flex row of zones + absolute marker */}
      <div className="relative flex h-2 overflow-hidden rounded" role="img" aria-label={`${label} ${clampedValue}%`}>
        {zones.map((z, i) => (
          <span
            key={i}
            className={`h-full ${ZONE_TOKENS[z.color]}`}
            style={{ width: `${z.fraction * 100}%` }}
          />
        ))}
        <span
          className="absolute top-[-3px] bottom-[-3px] w-[3px] rounded-sm bg-[var(--ink)] ring-2 ring-white"
          style={{ left: `calc(${clampedValue}% - 1.5px)` }}
          aria-hidden="true"
        />
      </div>

      {/* Ticks */}
      {ticks && ticks.length > 0 && (
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[var(--ink4)]">
          {ticks.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      )}

      {/* Note */}
      {note && (
        <div className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink3)]">
          {note}
        </div>
      )}
    </div>
  );
}

// Color palette — blended 35–70% with white for a softer look than
// pure saturated colors. Matches the prototype's zone aesthetic.
const ZONE_TOKENS: Record<ZoneColor, string> = {
  low: "bg-emerald-200",
  mid: "bg-amber-200",
  high: "bg-red-200",
  "info-a": "bg-blue-100",
  "info-b": "bg-blue-200",
  "info-c": "bg-blue-400",
};

const TAG_TOKENS: Record<"low" | "mid" | "high" | "info", string> = {
  low: "bg-emerald-50 text-emerald-700",
  mid: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
};
