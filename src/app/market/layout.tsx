import Link from "next/link";

export const metadata = {
  title: "UNILUME — 市场数据",
  description: "Noon 市场关键词数据浏览与搜索",
};

export default function MarketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-dvh bg-gray-50">
      {/* Header */}
      <header className="flex-none border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight text-gray-900 hover:text-brand-500 transition-colors"
            >
              UNILUME
            </Link>
            <span className="text-xs text-gray-400 border-l border-gray-200 pl-2 ml-1">
              市场数据
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              AI 助手
            </Link>
            <Link
              href="/policy-updates"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              变更日报
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
