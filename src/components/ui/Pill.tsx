"use client";

interface PillProps {
  label: string;
  onClick?: () => void;
}

export default function Pill({ label, onClick }: PillProps) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-[11px] font-medium text-[var(--ink2)] transition-all duration-200 hover:text-[var(--brand)] hover:border-[color-mix(in_srgb,var(--brand)_25%,transparent)] hover:bg-[var(--brand-soft)] hover:-translate-y-0.5 hover:shadow-md"
    >
      {label}
    </button>
  );
}
