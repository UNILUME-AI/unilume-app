"use client";

import { useEffect, useState } from "react";
import type { CrossMarketComparison } from "@/lib/market-data";

export default function CrossMarketSection({
  keyword,
}: {
  keyword: string;
}) {
  const [data, setData] = useState<CrossMarketComparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/market/compare?keyword=${encodeURIComponent(keyword)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [keyword]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-48 bg-gray-100 animate-pulse rounded" />
        <div className="h-40 bg-gray-50 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!data || (!data.uae && !data.ksa)) return null;

  // Only one market available
  if (!data.uae || !data.ksa) {
    const available = data.uae ? "UAE" : "KSA";
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold mb-2">跨市场对比</h3>
        <p className="text-sm text-gray-500">
          仅有 {available} 数据，暂无法对比
        </p>
      </div>
    );
  }

  const rows: {
    label: string;
    uae: string;
    ksa: string;
  }[] = [
    {
      label: "搜索结果",
      uae: data.uae.total_results.toLocaleString(),
      ksa: data.ksa.total_results.toLocaleString(),
    },
    {
      label: "中位价格",
      uae: `AED ${data.uae.price_median.toFixed(2)}`,
      ksa: `SAR ${data.ksa.price_median.toFixed(2)}`,
    },
    {
      label: "平均评分",
      uae: data.uae.avg_rating.toFixed(1),
      ksa: data.ksa.avg_rating.toFixed(1),
    },
    {
      label: "平均评论数",
      uae: data.uae.avg_review_count.toFixed(0),
      ksa: data.ksa.avg_review_count.toFixed(0),
    },
    {
      label: "广告占比",
      uae: `${data.uae.sponsored_pct}%`,
      ksa: `${data.ksa.sponsored_pct}%`,
    },
    {
      label: "FBN占比",
      uae: `${data.uae.fulfilled_pct}%`,
      ksa: `${data.ksa.fulfilled_pct}%`,
    },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold mb-4">跨市场对比</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">指标</th>
              <th className="py-2 pr-4 font-medium text-right">
                {"\u{1F1E6}\u{1F1EA}"} UAE
              </th>
              <th className="py-2 font-medium text-right">
                {"\u{1F1F8}\u{1F1E6}"} KSA
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-gray-100">
                <td className="py-2 pr-4 text-gray-600">{row.label}</td>
                <td className="py-2 pr-4 text-right font-medium">{row.uae}</td>
                <td className="py-2 text-right font-medium">{row.ksa}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.recommendation && (
        <p className="mt-4 text-sm text-brand-500 bg-brand-50 rounded-md px-3 py-2">
          {data.recommendation}
        </p>
      )}
    </div>
  );
}
