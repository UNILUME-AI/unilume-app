import Link from "next/link";
import dynamic from "next/dynamic";
import {
  getMarketOverview,
  getPriceTrend,
  getCompetitionAnalysis,
  getBrandDistribution,
  getPriceDistribution,
  getProductList,
} from "@/lib/market-data";
import MarketTabs from "./market-tabs";
import ProductTable from "./product-table";
import CrossMarketSection from "./cross-market-section";

const PriceTrendChart = dynamic(
  () => import("@/components/charts/price-trend-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-gray-50 animate-pulse rounded-lg" />
    ),
  },
);
const PriceDistributionChart = dynamic(
  () => import("@/components/charts/price-distribution-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-gray-50 animate-pulse rounded-lg" />
    ),
  },
);
const BrandPieChart = dynamic(
  () => import("@/components/charts/brand-pie-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-gray-50 animate-pulse rounded-lg" />
    ),
  },
);

// ── Helpers ──────────────────────────────────────

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  const days = Math.floor(hours / 24);
  return `${days} 天`;
}

function freshnessColor(isoDate: string): string {
  const hours =
    (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60);
  if (hours < 24) return "bg-green-100 text-green-700";
  if (hours < 72) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function FreshnessBadge({
  dataFreshness,
  productCount,
  totalResults,
}: {
  dataFreshness: string;
  productCount: number;
  totalResults: number;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${freshnessColor(dataFreshness)}`}
    >
      更新于 {timeAgo(dataFreshness)} 前 · 覆盖 Top {productCount} /{" "}
      {totalResults.toLocaleString()} 产品 · 每日 4 次采集
    </span>
  );
}

function currencyLabel(market: string): string {
  return market === "KSA" ? "SAR" : "AED";
}

const BARRIER_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: "bg-green-100", text: "text-green-700", label: "低门槛" },
  medium: { bg: "bg-amber-100", text: "text-amber-700", label: "中等门槛" },
  high: { bg: "bg-red-100", text: "text-red-700", label: "高门槛" },
};

// ── Page ─────────────────────────────────────────

export default async function KeywordDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ keyword: string }>;
  searchParams: Promise<{ market?: string }>;
}) {
  const { keyword: rawKeyword } = await params;
  const { market: marketParam } = await searchParams;
  const keyword = decodeURIComponent(rawKeyword);
  const market = marketParam || "UAE";
  const currency = currencyLabel(market);

  const [overview, trend, competition, brands, priceDist, products] =
    await Promise.all([
      getMarketOverview(keyword, market),
      getPriceTrend(keyword, 30),
      getCompetitionAnalysis(keyword),
      getBrandDistribution(keyword, market),
      getPriceDistribution(keyword, market),
      getProductList(keyword, market, "position", 20),
    ]);

  if (!overview) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500 mb-4">
          未找到关键词 &ldquo;{keyword}&rdquo; 的市场数据
        </p>
        <Link
          href="/market"
          className="text-blue-600 hover:underline text-sm"
        >
          返回市场数据首页
        </Link>
      </div>
    );
  }

  const barrier = competition
    ? BARRIER_STYLE[competition.entry_barrier]
    : null;

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/market" className="hover:text-blue-600 transition-colors">
            市场数据
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{keyword}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{keyword}</h1>
            <FreshnessBadge
              dataFreshness={overview.data_freshness}
              productCount={overview.product_count}
              totalResults={overview.total_results}
            />
          </div>
          <MarketTabs keyword={keyword} current={market} />
        </div>
      </div>

      {/* ── Overview cards ─────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          {
            label: "搜索结果",
            value: overview.total_results.toLocaleString(),
          },
          {
            label: "中位价格",
            value: `${currency} ${overview.price_median.toFixed(2)}`,
          },
          {
            label: "平均评分",
            value: overview.avg_rating.toFixed(1),
          },
          {
            label: "平均评论",
            value: overview.avg_review_count.toFixed(0),
          },
          {
            label: "广告占比",
            value: `${overview.sponsored_pct}%`,
          },
          {
            label: "FBN占比",
            value: `${overview.fulfilled_pct}%`,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className="text-lg font-semibold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Entry barrier badge ────────────────── */}
      {barrier && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">进入门槛:</span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${barrier.bg} ${barrier.text}`}
          >
            {barrier.label}
          </span>
          {competition && (
            <span className="text-xs text-gray-400">
              ({competition.unique_sellers} 卖家 · Top10 占比{" "}
              {competition.top10_share_pct}%)
            </span>
          )}
        </div>
      )}

      {/* ── Charts row ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            价格趋势 (30天)
          </h2>
          <PriceTrendChart data={trend.daily} />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            价格分布
          </h2>
          <PriceDistributionChart
            data={priceDist?.buckets ?? []}
          />
        </div>
      </div>

      {/* ── Brand + Competition row ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            品牌分布
          </h2>
          <BrandPieChart data={brands?.brands ?? []} />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Top 卖家
          </h2>
          {competition && competition.top10_sellers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2 pr-2 font-medium">卖家</th>
                    <th className="py-2 pr-2 font-medium text-right">产品数</th>
                    <th className="py-2 font-medium text-right">均价</th>
                  </tr>
                </thead>
                <tbody>
                  {competition.top10_sellers.map((s) => (
                    <tr
                      key={s.name}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-1.5 pr-2 truncate max-w-[200px]" title={s.name}>
                        {s.name}
                      </td>
                      <td className="py-1.5 pr-2 text-right">{s.count}</td>
                      <td className="py-1.5 text-right">
                        {currency} {s.avg_price.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">
              暂无卖家数据
            </p>
          )}
        </div>
      </div>

      {/* ── Cross-market section ───────────────── */}
      <CrossMarketSection keyword={keyword} />

      {/* ── Product list ───────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          产品列表
        </h2>
        <ProductTable
          keyword={keyword}
          market={market}
          initialProducts={products}
        />
      </div>
    </div>
  );
}
