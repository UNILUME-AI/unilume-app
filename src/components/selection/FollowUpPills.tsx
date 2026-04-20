"use client";

import Pill from "@/components/ui/Pill";
import type { FollowUpSuggestion } from "@/lib/selection/mock/ui-state";

export interface FollowUpPillsProps {
  suggestions: FollowUpSuggestion[];
  /** Called with the suggestion's `text` when a pill is clicked. */
  onPick: (text: string, suggestion: FollowUpSuggestion) => void;
}

/**
 * "继续探索" section — a label + a row of Pill buttons.
 * Rendered after the Agent finishes a full analysis round.
 */
export default function FollowUpPills({ suggestions, onPick }: FollowUpPillsProps) {
  if (suggestions.length === 0) return null;

  return (
    <section className="mt-4">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--ink3)]">
        继续探索
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <Pill
            key={s.text}
            label={s.text}
            onClick={() => onPick(s.text, s)}
          />
        ))}
      </div>
    </section>
  );
}
