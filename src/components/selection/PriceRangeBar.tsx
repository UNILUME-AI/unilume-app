"use client";

import type { PriceDistribution } from "@/lib/selection/mock/types";

export interface PriceRangeBarProps {
  distribution: PriceDistribution;
}

/**
 * 3-row price distribution bar — track + percentile values + percentile
 * labels + extremes. This is the "fixed" version from the UI review
 * (originally 5 labels on one row, which overflowed on narrow viewports).
 *
 * Layout positions percentiles by linear interpolation against min..max,
 * which is visually more honest than evenly spacing them.
 */
export default function PriceRangeBar({ distribution }: PriceRangeBarProps) {
  const { min, p25, median, p75, max, currency, suggestedPrice } = distribution;
  const span = max - min;

  /** Convert an absolute price to a horizontal percentage within [min, max]. */
  const toPct = (v: number): number =>
    span > 0 ? ((v - min) / span) * 100 : 50;

  const p25Pct = toPct(p25);
  const medianPct = toPct(median);
  const p75Pct = toPct(p75);
  const suggestedPct = suggestedPrice !== undefined ? toPct(suggestedPrice) : null;

  return (
    <div className="my-3">
      {/* Track: soft range fill (P25–P75) + markers + floating median badge */}
      <div className="relative my-2 h-8 rounded-md bg-stone-100">
        {/* Interquartile band */}
        <span
          className="absolute top-1 bottom-1 rounded-sm"
          style={{
            left: `${p25Pct}%`,
            right: `${100 - p75Pct}%`,
            background:
              "linear-gradient(90deg, var(--color-brand-100), color-mix(in srgb, var(--brand) 25%, transparent))",
          }}
        />
        {/* P25 marker */}
        <span
          className="absolute -top-0.5 -bottom-0.5 w-[2px] rounded-sm bg-blue-500"
          style={{ left: `calc(${p25Pct}% - 1px)` }}
        />
        {/* Median marker (brand color, thicker) */}
        <span
          className="absolute -top-0.5 -bottom-0.5 w-[3px] rounded-sm bg-[var(--brand)]"
          style={{ left: `calc(${medianPct}% - 1.5px)` }}
        />
        {/* P75 marker */}
        <span
          className="absolute -top-0.5 -bottom-0.5 w-[2px] rounded-sm bg-blue-500"
          style={{ right: `calc(${100 - p75Pct}% - 1px)` }}
        />
        {/* Suggested-price chevron (if provided) */}
        {suggestedPct !== null && (
          <span
            className="absolute -bottom-[6px] text-[10px] text-[var(--brand)]"
            style={{ left: `calc(${suggestedPct}% - 4px)` }}
            >
            ▲
          </span>
        )}
        {/* Floating median badge */}
        <span
          className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded border border-[color-mix(in_srgb,var(--brand)_25%,transparent)] bg-white px-1.5 py-0.5 text-[11px] font-bold text-[var(--brand)] shadow-sm"
          style={{ left: `${medianPct}%` }}
        >
          中位 {median} {currency}
        </span>
      </div>

      {/* Row 1: percentile values */}
      <div className="relative h-4 text-[11px] font-semibold tabular-nums text-[var(--ink2)]">
        <span className="absolute -translate-x-1/2" style={{ left: `${p25Pct}%` }}>
          {p25}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: `${p75Pct}%` }}>
          {p75}
        </span>
      </div>

      {/* Row 2: percentile labels */}
      <div className="relative h-3.5 text-[10px] font-medium tracking-wide text-[var(--ink4)]">
        <span className="absolute -translate-x-1/2" style={{ left: `${p25Pct}%` }}>
          P25
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: `${p75Pct}%` }}>
          P75
        </span>
      </div>

      {/* Row 3: extremes */}
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[var(--ink4)]">
        <span>
          {min} {currency}
        </span>
        <span>
          {max} {currency}
        </span>
      </div>
    </div>
  );
}
