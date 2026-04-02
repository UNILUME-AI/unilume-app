import AppHeader from "@/components/shared/AppHeader";

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
      <AppHeader maxWidth="max-w-5xl" />

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
