"use client";

import { useState } from "react";
import type { SubCategory } from "@/lib/selection/mock/types";

export interface SubCategoryPickerProps {
  options: SubCategory[];
  /** Called with the selected subcategory. Called exactly once per selection. */
  onSelect: (subcategory: SubCategory) => void;
  /** Pre-selected id, if any. */
  defaultSelectedId?: string;
}

/**
 * 2×2 grid of subcategory cards. Each card shows:
 *   - name (English + Chinese)
 *   - independent product count
 *   - price band
 *   - competition level as a 5-segment bar + label
 *
 * Exactly one card can be selected — stateful via `useState` so the
 * parent can render optimistically while the "real" agent spins up
 * the next analysis round.
 */
export default function SubCategoryPicker({
  options,
  onSelect,
  defaultSelectedId,
}: SubCategoryPickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelectedId ?? null);

  const handlePick = (cat: SubCategory) => {
    setSelectedId(cat.id);
    onSelect(cat);
  };

  return (
    <>
      <div
        role="radiogroup"
        aria-label="选择子类目"
        className="my-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {options.map((cat) => {
          const isSelected = selectedId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handlePick(cat)}
              className={[
                "group rounded-[10px] border-[1.5px] bg-white p-3 text-left transition-all duration-200",
                "hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--brand)_30%,transparent)] hover:bg-[var(--brand-soft)] hover:shadow-md",
                isSelected
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] ring-2 ring-[color-mix(in_srgb,var(--brand)_15%,transparent)]"
                  : "border-[var(--border)]",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[15px] font-bold leading-tight tracking-tight text-[var(--ink)]">
                  {cat.name}
                </div>
                <div className="text-[11px] text-[var(--ink3)]">{cat.nameZh}</div>
              </div>
              <div className="mt-1.5 text-[13px] font-medium tabular-nums text-[var(--ink2)]">
                约 {formatCount(cat.count)} 个商品
              </div>
              <div className="text-[13px] tabular-nums text-[var(--ink2)]">
                {cat.priceBand.min}–{cat.priceBand.max} {cat.priceBand.currency}
              </div>
              <CompetitionBars level={cat.competitionLevel} filled={cat.competitionScore} />
            </button>
          );
        })}
      </div>
      <p className="text-[12px] italic text-[var(--ink4)]">
        * 商品数含变体，实际独立产品数更少
      </p>
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1000) return `${Math.floor(n / 1000)},${String(n % 1000).padStart(3, "0")}+`;
  return String(n);
}

function CompetitionBars({
  level,
  filled,
}: {
  level: SubCategory["competitionLevel"];
  filled: 1 | 2 | 3 | 4 | 5;
}) {
  const label =
    level === "high" ? "竞争激烈" : level === "mod" ? "竞争中等" : "竞争较小";
  const fillClass =
    level === "high" ? "bg-red-500" : level === "mod" ? "bg-amber-500" : "bg-emerald-500";
  const emptyClass = "bg-stone-200";

  return (
    <div className="mt-1 flex items-center gap-1.5">
      <span className="flex gap-[1.5px]" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1 w-2.5 rounded-[1px] ${i < filled ? fillClass : emptyClass}`}
          />
        ))}
      </span>
      <span className="text-[12px] text-[var(--ink3)]">{label}</span>
    </div>
  );
}
