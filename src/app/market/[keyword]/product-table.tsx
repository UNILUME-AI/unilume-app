"use client";

import { useState } from "react";
import type { ProductListItem } from "@/lib/market-data";

const SORT_OPTIONS = [
  { key: "position", label: "排名" },
  { key: "price_current", label: "价格" },
  { key: "rating", label: "评分" },
  { key: "review_count", label: "评论数" },
] as const;

export default function ProductTable({
  keyword,
  market,
  initialProducts,
}: {
  keyword: string;
  market: string;
  initialProducts: ProductListItem[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [sortBy, setSortBy] = useState("position");
  const [loading, setLoading] = useState(false);

  const handleSort = async (key: string) => {
    if (key === sortBy) return;
    setSortBy(key);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/market/products?keyword=${encodeURIComponent(keyword)}&market=${market}&sortBy=${key}&limit=20`,
      );
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products ?? data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Sort buttons */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500">排序:</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => handleSort(opt.key)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              sortBy === opt.key
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className={`overflow-x-auto ${loading ? "opacity-50" : ""}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 pr-2 font-medium w-10">#</th>
              <th className="py-2 pr-2 font-medium min-w-[200px]">产品</th>
              <th className="py-2 pr-2 font-medium">品牌</th>
              <th className="py-2 pr-2 font-medium text-right">价格</th>
              <th className="py-2 pr-2 font-medium text-right">评分</th>
              <th className="py-2 pr-2 font-medium text-right">评论</th>
              <th className="py-2 font-medium">卖家</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr
                key={p.sku || i}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="py-2 pr-2 text-gray-400">{p.position}</td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-1.5">
                    {p.is_sponsored && (
                      <span className="shrink-0 rounded bg-[#fffae6] px-1 py-0.5 text-[10px] font-medium text-[#cf7c00]">
                        Ad
                      </span>
                    )}
                    <span className="truncate max-w-[260px]" title={p.title}>
                      {p.title}
                    </span>
                  </div>
                </td>
                <td className="py-2 pr-2 text-gray-600">{p.brand || "—"}</td>
                <td className="py-2 pr-2 text-right font-medium">
                  {p.price_current.toFixed(2)}
                </td>
                <td className="py-2 pr-2 text-right">
                  {p.rating != null ? p.rating.toFixed(1) : "—"}
                </td>
                <td className="py-2 pr-2 text-right">
                  {p.review_count.toLocaleString()}
                </td>
                <td className="py-2 text-gray-600 truncate max-w-[140px]" title={p.seller_name}>
                  {p.seller_name || "—"}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  暂无产品数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
