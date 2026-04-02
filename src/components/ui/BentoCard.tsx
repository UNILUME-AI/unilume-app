"use client";

import { useRef, useCallback } from "react";
import CategoryBadge, { type BadgeCategory } from "./CategoryBadge";

const GLOW_MAP: Record<BadgeCategory, string> = {
  market: "rgba(37,99,235,.12)",
  logistics: "rgba(5,150,105,.12)",
  policy: "rgba(124,58,237,.12)",
  guide: "rgba(217,119,6,.12)",
};

interface BentoCardProps {
  category: BadgeCategory;
  categoryLabel: string;
  title: string;
  description?: string;
  span?: number;
  onClick?: () => void;
}

export default function BentoCard({
  category,
  categoryLabel,
  title,
  description,
  span = 4,
  onClick,
}: BentoCardProps) {
  const ref = useRef<HTMLButtonElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const tiltX = ((e.clientY - rect.top) / rect.height - 0.5) * -8;
    const tiltY = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
    el.style.transform = `perspective(600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
    el.style.setProperty("--mx", `${x}%`);
    el.style.setProperty("--my", `${y}%`);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (el) el.style.transform = "perspective(600px) rotateX(0) rotateY(0) scale(1)";
  }, []);

  const spanClass =
    span === 8 ? "col-span-12 sm:col-span-8" :
    span === 7 ? "col-span-12 sm:col-span-7" :
    span === 6 ? "col-span-12 sm:col-span-6" :
    span === 5 ? "col-span-12 sm:col-span-5" :
    "col-span-12 sm:col-span-4";

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`bento-card relative overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-white p-[18px] text-left transition-all duration-300 cursor-pointer hover:border-[var(--border-hover)] hover:shadow-lg ${spanClass}`}
      style={{ "--glow-color": GLOW_MAP[category] } as React.CSSProperties}
    >
      <CategoryBadge category={category} label={categoryLabel} />
      <div className="mt-2.5 text-sm font-semibold leading-[1.5] text-[var(--ink)] tracking-[-0.15px]">
        {title}
      </div>
      {description && (
        <div className="mt-1 text-[12.5px] text-[var(--ink3)] leading-[1.5]">
          {description}
        </div>
      )}
    </button>
  );
}
