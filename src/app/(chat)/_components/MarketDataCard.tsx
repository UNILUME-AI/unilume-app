"use client";

import Link from "next/link";
import type { MarketDataLink } from "../_lib/types";

const TOOL_LABELS: Record<string, string> = {
  analyze_market: "市场分析",
  compare_markets: "跨市场对比",
  list_products: "商品列表",
  analyze_brands: "品牌分布",
  browse_keywords: "关键词浏览",
};

const ChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 16.5 2h-1ZM9.5 6A1.5 1.5 0 0 0 8 7.5v9A1.5 1.5 0 0 0 9.5 18h1a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 10.5 6h-1ZM3.5 10A1.5 1.5 0 0 0 2 11.5v5A1.5 1.5 0 0 0 3.5 18h1A1.5 1.5 0 0 0 6 16.5v-5A1.5 1.5 0 0 0 4.5 10h-1Z" />
  </svg>
);

export default function MarketDataCard({ link }: { link: MarketDataLink }) {
  const label = TOOL_LABELS[link.toolName] || "市场数据";

  return (
    <Link
      href={`/market/${encodeURIComponent(link.keyword)}?market=${link.market}`}
      className="mt-2 flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 no-underline hover:bg-gray-100 hover:border-gray-300 transition-colors group"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--brand)] text-white">
        <ChartIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 truncate">
          {link.keyword} {label}
        </p>
        <p className="text-[11px] text-gray-400">
          {link.market} · 查看完整数据 →
        </p>
      </div>
    </Link>
  );
}
