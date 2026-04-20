"use client";

import type { ReactNode } from "react";

/**
 * Shared layout primitives for DetailPanel children. Keeping them here
 * avoids copy-pasting KV row / section heading styles across 4 files.
 */

export function DPSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-2.5 border-b border-[var(--border)] pb-2 text-[14px] font-bold tracking-tight text-[var(--ink)]">
        {title}
      </h3>
      {subtitle && (
        <p className="-mt-1 mb-2.5 text-[12px] leading-relaxed text-[var(--ink3)]">
          {subtitle}
        </p>
      )}
      {children}
    </section>
  );
}

export function DPKV({
  label,
  value,
  note,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  tone?: "default" | "strong" | "positive" | "negative";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-600"
        : tone === "strong"
          ? "font-semibold text-[var(--ink)]"
          : "text-[var(--ink)]";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]">
      <span className="text-[var(--ink3)]">{label}</span>
      <span className={`text-right font-semibold tabular-nums ${valueClass}`}>
        {value}
        {note && (
          <span className="ml-1 text-[12px] font-normal text-[var(--ink4)]">
            {note}
          </span>
        )}
      </span>
    </div>
  );
}
