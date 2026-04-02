"use client";

const VARIANTS = {
  market: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    icon: (
      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 3v18h18M7 16l4-4 4 4 5-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  logistics: {
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    icon: (
      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M20 7l-8-4-8 4m16 0v10l-8 4m8-14l-8 4m0 0L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  policy: {
    bg: "bg-violet-50",
    text: "text-violet-600",
    icon: (
      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" />
      </svg>
    ),
  },
  guide: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    icon: (
      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" strokeLinecap="round" />
      </svg>
    ),
  },
} as const;

export type BadgeCategory = keyof typeof VARIANTS;

interface CategoryBadgeProps {
  category: BadgeCategory;
  label: string;
}

export default function CategoryBadge({ category, label }: CategoryBadgeProps) {
  const v = VARIANTS[category];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold leading-[1.5] tracking-wide ${v.bg} ${v.text}`}
    >
      {v.icon}
      {label}
    </span>
  );
}
