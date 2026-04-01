export default function Loading() {
  return (
    <div className="flex flex-col min-h-dvh bg-gray-50">
      <header className="flex-none border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight text-gray-900">
              UNILUME
            </span>
            <span className="text-xs text-gray-400 border-l border-gray-200 pl-2 ml-1">
              政策变更日报
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <div className="text-sm text-gray-400 animate-pulse">加载中...</div>
      </main>
    </div>
  );
}
