import Link from "next/link";
import { getAvailableKeywords, getKeywordCategories } from "@/lib/market-data";
import SearchBar from "./search-bar";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth} 个月前`;
}

const MARKET_COLORS: Record<string, string> = {
  UAE: "bg-green-50 text-green-700 border-green-200",
  KSA: "bg-purple-50 text-purple-700 border-purple-200",
};

export default async function MarketPage() {
  const [keywords, categories] = await Promise.all([
    getAvailableKeywords(),
    getKeywordCategories(),
  ]);

  return (
    <>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">市场数据</h1>
      <p className="text-sm text-gray-500 mb-6">
        浏览已收录的关键词市场数据，或搜索新关键词。
      </p>

      {/* Search */}
      <div className="mb-8">
        <SearchBar />
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            按分类浏览
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categories.map((cat) => (
              <div
                key={cat.category}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                <div className="text-sm font-medium text-gray-800">
                  {cat.category}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {cat.count} 个关键词
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {cat.keywords.slice(0, 3).map((kw) => (
                    <Link
                      key={kw}
                      href={`/market/${encodeURIComponent(kw)}`}
                      className="inline-block rounded-md border border-gray-100 bg-gray-50 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                    >
                      {kw}
                    </Link>
                  ))}
                  {cat.keywords.length > 3 && (
                    <span className="text-xs text-gray-400 py-0.5">
                      +{cat.keywords.length - 3}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Keywords table */}
      {keywords.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            全部关键词（{keywords.length}）
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-4 py-2 font-medium">关键词</th>
                  <th className="px-4 py-2 font-medium">市场</th>
                  <th className="px-4 py-2 font-medium text-right">更新时间</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw) => (
                  <tr
                    key={kw.keyword}
                    className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/market/${encodeURIComponent(kw.keyword)}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {kw.keyword}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {kw.markets.map((m) => (
                          <span
                            key={m}
                            className={`inline-block rounded-md border px-1.5 py-0.5 text-xs font-medium ${MARKET_COLORS[m] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-400">
                      {timeAgo(kw.last_updated)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="text-center text-gray-500 py-20">
          <p className="text-lg font-medium">暂无关键词数据</p>
          <p className="text-sm mt-1">
            数据将在市场爬取完成后自动出现。
          </p>
        </div>
      )}
    </>
  );
}
