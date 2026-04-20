"use client";

import { useState } from "react";
import type { Market } from "@/lib/selection/mock/types";

export interface MarketOption {
  code: Market;
  flag: string;       // emoji, e.g. "🇦🇪"
  name: string;       // "UAE (阿联酋)"
  meta: string;       // "AED · VAT 5% · 1440 万人口 · 电商成熟度高"
}

export interface MarketPickerProps {
  options?: MarketOption[];
  onSelect: (market: MarketOption) => void;
  defaultSelected?: Market;
}

const DEFAULT_OPTIONS: MarketOption[] = [
  {
    code: "UAE",
    flag: "🇦🇪",
    name: "UAE (阿联酋)",
    meta: "AED · VAT 5% · 1440 万人口 · 电商成熟度高",
  },
  {
    code: "KSA",
    flag: "🇸🇦",
    name: "KSA (沙特)",
    meta: "SAR · VAT 15% · 3500 万人口 · 增长最快的 MENA 市场",
  },
];

/**
 * 2-card market picker (UAE / KSA). Used in the `ask_market` scene when
 * the Agent needs to know which market before running analysis.
 */
export default function MarketPicker({
  options = DEFAULT_OPTIONS,
  onSelect,
  defaultSelected,
}: MarketPickerProps) {
  const [selected, setSelected] = useState<Market | null>(defaultSelected ?? null);

  const handlePick = (opt: MarketOption) => {
    setSelected(opt.code);
    onSelect(opt);
  };

  return (
    <div className="my-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {options.map((opt) => {
        const isSelected = selected === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => handlePick(opt)}
            data-selected={isSelected}
            className={[
              "rounded-[10px] border-[1.5px] bg-white p-3.5 text-left transition-all duration-200",
              "hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--brand)_30%,transparent)] hover:bg-[var(--brand-soft)] hover:shadow-md",
              isSelected
                ? "border-[var(--brand)] bg-[var(--brand-soft)] ring-2 ring-[color-mix(in_srgb,var(--brand)_15%,transparent)]"
                : "border-[var(--border)]",
            ].join(" ")}
          >
            <div>
              <span className="mr-1.5 text-[20px]">
                {opt.flag}
              </span>
              <span className="text-[15px] font-semibold align-middle text-[var(--ink)]">
                {opt.name}
              </span>
            </div>
            <div className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink3)]">
              {opt.meta}
            </div>
          </button>
        );
      })}
    </div>
  );
}
