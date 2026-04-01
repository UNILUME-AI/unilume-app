import fs from "fs";
import path from "path";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────

interface ArticleChange {
  permalink: string;
  title: string;
  category: string;
  webUrl?: string;
  old_time?: string;
  new_time?: string;
}

interface RenamedArticle {
  permalink: string;
  title: string;
  old_title: string;
  old_permalink: string;
  category: string;
  webUrl?: string;
}

interface ContentDiff {
  added_lines: number;
  removed_lines: number;
  excerpts: string[];
}

interface ChangeReport {
  added: ArticleChange[];
  removed: ArticleChange[];
  modified: ArticleChange[];
  renamed?: RenamedArticle[];
  content_diffs?: Record<string, ContentDiff>;
  old_total: number;
  new_total: number;
  old_timestamp: string;
  new_timestamp: string;
}

interface SnapshotArticle {
  webUrl?: string;
  title?: string;
  category?: string;
}

// ── Data Loading ───────────────────────────────────────

function loadJson<T>(relPath: string): T | null {
  const filePath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/** Compute string similarity (0–1) */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  // Levenshtein-based ratio
  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastVal = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) { costs[j] = j; continue; }
      if (j > 0) {
        let newVal = costs[j - 1];
        if (shorter[i - 1] !== longer[j - 1])
          newVal = Math.min(newVal, lastVal, costs[j]) + 1;
        costs[j - 1] = lastVal;
        lastVal = newVal;
      }
    }
    if (i > 0) costs[longer.length] = lastVal;
  }
  return 1 - costs[longer.length] / longer.length;
}

function enrichReport(report: ChangeReport): ChangeReport {
  // If the crawler already produced renamed/webUrl, use as-is
  if (report.renamed && report.renamed.length > 0) return report;

  // Load snapshot for webUrl lookup
  const snapshot = loadJson<{ articles: Record<string, SnapshotArticle> }>(
    "src/data/noon-docs/_metadata/previous_snapshot.json"
  );
  const snapArticles = snapshot?.articles ?? {};

  // Build webUrl lookup from snapshot (both old and current)
  const urlMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(snapArticles)) {
    if (v.webUrl) urlMap[k] = v.webUrl;
  }

  // Enrich webUrl on all articles
  const enrich = (a: ArticleChange): ArticleChange => ({
    ...a,
    webUrl: a.webUrl || urlMap[a.permalink] || "",
  });

  const added = report.added.map(enrich);
  const removed = report.removed.map(enrich);
  const modified = report.modified.map(enrich);

  // Detect renames: match added/removed with similar permalink or title in same category
  const renamed: RenamedArticle[] = [];
  const usedAdded = new Set<number>();
  const usedRemoved = new Set<number>();

  for (let ri = 0; ri < removed.length; ri++) {
    const r = removed[ri];
    let bestScore = 0;
    let bestAi = -1;
    for (let ai = 0; ai < added.length; ai++) {
      if (usedAdded.has(ai)) continue;
      const a = added[ai];
      if (a.category !== r.category) continue;
      const score = Math.max(
        similarity(r.permalink, a.permalink),
        similarity(r.title, a.title)
      );
      if (score > bestScore) { bestScore = score; bestAi = ai; }
    }
    if (bestScore >= 0.7 && bestAi >= 0) {
      const a = added[bestAi];
      renamed.push({
        permalink: a.permalink,
        title: a.title,
        old_title: r.title,
        old_permalink: r.permalink,
        category: a.category,
        webUrl: a.webUrl,
      });
      usedAdded.add(bestAi);
      usedRemoved.add(ri);
    }
  }

  return {
    ...report,
    added: added.filter((_, i) => !usedAdded.has(i)),
    removed: removed.filter((_, i) => !usedRemoved.has(i)),
    modified,
    renamed,
  };
}

// ── Helpers ────────────────────────────────────────────

function groupByCategory<T extends { category: string }>(articles: T[]) {
  const groups: Record<string, T[]> = {};
  for (const a of articles) {
    const cat = a.category || "Unknown";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(a);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function formatDate(ts: string) {
  if (!ts || ts === "?" || ts === "(first run)") return ts;
  return ts.slice(0, 10);
}

// ── Components ─────────────────────────────────────────

function StatCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "green" | "amber" | "red" | "blue" | "gray";
}) {
  const colorClasses = {
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-center ${colorClasses[color]}`}
    >
      <div className="text-2xl font-semibold">{count}</div>
      <div className="text-xs mt-0.5">{label}</div>
    </div>
  );
}

function ArticleTitle({
  title,
  webUrl,
}: {
  title: string;
  webUrl?: string;
}) {
  if (webUrl) {
    return (
      <a
        href={webUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-700 hover:text-blue-900 hover:underline"
      >
        {title}
        <span className="inline-block ml-1 text-gray-400 text-xs">↗</span>
      </a>
    );
  }
  return <span className="text-sm text-gray-800">{title}</span>;
}

function DiffBadge({ diff }: { diff: ContentDiff }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono">
      <span className="text-green-600">+{diff.added_lines}</span>
      <span className="text-gray-400">/</span>
      <span className="text-red-500">-{diff.removed_lines}</span>
      <span className="text-gray-400">行</span>
    </span>
  );
}

function ExcerptList({ excerpts }: { excerpts: string[] }) {
  if (excerpts.length === 0) return null;
  return (
    <div className="mt-1.5 space-y-0.5">
      {excerpts.map((line, i) => {
        const isAdd = line.startsWith("+ ");
        const isRemove = line.startsWith("- ");
        return (
          <div
            key={i}
            className={`text-xs font-mono rounded px-2 py-0.5 ${
              isAdd
                ? "bg-green-50 text-green-700"
                : isRemove
                  ? "bg-red-50 text-red-500 line-through"
                  : "bg-gray-50 text-gray-600"
            }`}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}

function ArticleList({
  articles,
  type,
  contentDiffs,
}: {
  articles: ArticleChange[];
  type: "added" | "modified" | "removed";
  contentDiffs?: Record<string, ContentDiff>;
}) {
  const grouped = groupByCategory(articles);

  return (
    <div className="space-y-4">
      {grouped.map(([category, items]) => (
        <div key={category}>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            {category}
          </h4>
          <div className="space-y-2">
            {items.map((a) => {
              const diff = contentDiffs?.[a.permalink];
              return (
                <div
                  key={a.permalink}
                  className="rounded-lg border border-gray-100 bg-white px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <ArticleTitle title={a.title} webUrl={a.webUrl} />
                    <div className="flex-none">
                      {type === "modified" && diff && <DiffBadge diff={diff} />}
                      {type === "added" && diff && (
                        <span className="text-xs text-green-600 font-mono">
                          {diff.added_lines} 行
                        </span>
                      )}
                    </div>
                  </div>
                  {type === "modified" && a.old_time && a.new_time && !diff && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {a.old_time} &rarr; {a.new_time}
                    </div>
                  )}
                  {diff && diff.excerpts.length > 0 && (
                    <ExcerptList excerpts={diff.excerpts} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function RenamedList({ articles }: { articles: RenamedArticle[] }) {
  const grouped = groupByCategory(articles);

  return (
    <div className="space-y-4">
      {grouped.map(([category, items]) => (
        <div key={category}>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            {category}
          </h4>
          <div className="space-y-2">
            {items.map((a) => (
              <div
                key={a.permalink}
                className="rounded-lg border border-gray-100 bg-white px-3 py-2"
              >
                <div className="text-sm">
                  <span className="text-gray-400 line-through">
                    {a.old_title}
                  </span>
                  <span className="text-gray-400 mx-2">&rarr;</span>
                  <ArticleTitle title={a.title} webUrl={a.webUrl} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────

export const metadata = {
  title: "政策变更日报 — UNILUME",
  description: "Noon 卖家帮助中心每日内容变更追踪",
};

export default function PolicyUpdatesPage() {
  const raw = loadJson<ChangeReport>(
    "src/data/noon-docs/_metadata/change_report.json"
  );
  const report = raw ? enrichReport(raw) : null;

  const renamed = report?.renamed ?? [];
  const diffs = report?.content_diffs ?? {};

  // 将 modified 拆分为"内容修改"和"仅元数据更新"
  const contentModified = report?.modified.filter((a) => {
    const d = diffs[a.permalink];
    return !d || d.excerpts.length > 0;
  }) ?? [];
  const metadataOnly = report?.modified.filter((a) => {
    const d = diffs[a.permalink];
    return d && d.excerpts.length === 0;
  }) ?? [];

  const hasChanges =
    report &&
    (report.added.length > 0 ||
      contentModified.length > 0 ||
      report.removed.length > 0 ||
      renamed.length > 0 ||
      metadataOnly.length > 0);

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50">
      {/* Header */}
      <header className="flex-none border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight text-gray-900 hover:text-blue-600 transition-colors"
            >
              UNILUME
            </Link>
            <span className="text-xs text-gray-400 border-l border-gray-200 pl-2 ml-1">
              政策变更日报
            </span>
          </div>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            &larr; 返回助手
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {!report ? (
            <div className="text-center text-gray-500 py-20">
              <p className="text-lg font-medium">暂无变更数据</p>
              <p className="text-sm mt-1">
                变更报告将在每日爬取完成后自动生成。
              </p>
            </div>
          ) : (
            <>
              {/* Report header */}
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900">
                  Noon 帮助中心变更报告
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  快照对比：{formatDate(report.old_timestamp)} &rarr;{" "}
                  {formatDate(report.new_timestamp)}
                  &nbsp;&middot;&nbsp;
                  总文章数 {report.old_total} &rarr; {report.new_total}
                </p>
              </div>

              {/* Summary cards */}
              <div
                className={`grid gap-3 mb-6 ${renamed.length > 0 ? "grid-cols-4" : "grid-cols-3"}`}
              >
                {renamed.length > 0 && (
                  <StatCard
                    label="重命名"
                    count={renamed.length}
                    color="blue"
                  />
                )}
                <StatCard
                  label="新增"
                  count={report.added.length}
                  color="green"
                />
                <StatCard
                  label="内容修改"
                  count={contentModified.length}
                  color="amber"
                />
                <StatCard
                  label="删除"
                  count={report.removed.length}
                  color="red"
                />
              </div>

              {!hasChanges ? (
                <div className="text-center text-gray-500 py-12 rounded-xl border border-gray-200 bg-white">
                  <p className="text-lg font-medium">无变更</p>
                  <p className="text-sm mt-1">本次快照对比未发现内容变化。</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Renamed */}
                  {renamed.length > 0 && (
                    <section>
                      <details open>
                        <summary className="cursor-pointer text-sm font-semibold text-blue-700 mb-3 select-none">
                          重命名文章（{renamed.length}）
                        </summary>
                        <RenamedList articles={renamed} />
                      </details>
                    </section>
                  )}

                  {/* Content Modified */}
                  {contentModified.length > 0 && (
                    <section>
                      <details open>
                        <summary className="cursor-pointer text-sm font-semibold text-amber-700 mb-3 select-none">
                          内容修改（{contentModified.length}）
                        </summary>
                        <ArticleList
                          articles={contentModified}
                          type="modified"
                          contentDiffs={report.content_diffs}
                        />
                      </details>
                    </section>
                  )}

                  {/* Added */}
                  {report.added.length > 0 && (
                    <section>
                      <details open={report.added.length <= 20}>
                        <summary className="cursor-pointer text-sm font-semibold text-green-700 mb-3 select-none">
                          新增文章（{report.added.length}）
                        </summary>
                        <ArticleList
                          articles={report.added}
                          type="added"
                          contentDiffs={report.content_diffs}
                        />
                      </details>
                    </section>
                  )}

                  {/* Removed */}
                  {report.removed.length > 0 && (
                    <section>
                      <details open>
                        <summary className="cursor-pointer text-sm font-semibold text-red-600 mb-3 select-none">
                          删除文章（{report.removed.length}）
                        </summary>
                        <ArticleList
                          articles={report.removed}
                          type="removed"
                        />
                      </details>
                    </section>
                  )}

                  {/* Metadata Only */}
                  {metadataOnly.length > 0 && (
                    <section>
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-gray-400 mb-3 select-none">
                          仅元数据更新（{metadataOnly.length}）— 正文内容无实质变化
                        </summary>
                        <ArticleList
                          articles={metadataOnly}
                          type="modified"
                          contentDiffs={report.content_diffs}
                        />
                      </details>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="flex-none border-t border-gray-200 bg-white px-4 py-3">
        <p className="mx-auto max-w-3xl text-center text-xs text-gray-400">
          数据来源：Noon 官方帮助中心 &middot; 每日自动更新
        </p>
      </footer>
    </div>
  );
}
