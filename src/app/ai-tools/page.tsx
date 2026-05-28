/**
 * GET /ai-tools
 *
 * UNILUME AI Tools 参考页. LLM 可调用的 tool 清单, 运行时从 src/lib/tools.ts
 * 的 description + inputSchema (zod) + TOOL_META 提取, 不读静态文件.
 *
 * 跟 /api-docs (Scalar HTTP API 文档) 是姊妹页:
 *   /api-docs   渲染 HTTP API (OpenAPI 3.1 spec)
 *   /ai-tools   渲染 LLM tool 协议
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getToolSpecs, type ToolSpec } from "@/lib/ai-tools-spec";

export const metadata: Metadata = {
  title: "UNILUME AI Tools",
  description: "LLM tool registry — auto-generated from src/lib/tools.ts",
};

export default function AiToolsPage() {
  const { generatedAt, totalCount, groups } = getToolSpecs();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 text-slate-800">
      <header className="mb-10 border-b border-slate-200 pb-6">
        <h1 className="mb-3 text-3xl font-semibold text-slate-900">
          UNILUME AI Tools
        </h1>
        <p className="text-sm text-slate-600">
          Chat / Selection Agent 可调用的{" "}
          <span className="font-mono text-slate-900">{totalCount}</span> 个 LLM
          tool · 自动从{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
            src/lib/tools.ts
          </code>{" "}
          运行时提取
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Generated at {generatedAt} · 改 tool 后刷新本页即可看最新; 不需要手动跑脚本.
          <span className="ml-3">
            HTTP API 文档见{" "}
            <Link
              href="/api-docs"
              className="text-indigo-600 underline-offset-2 hover:underline"
            >
              /api-docs
            </Link>
            .
          </span>
        </p>
      </header>

      <nav className="mb-10 rounded-lg border border-slate-200 bg-slate-50 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
          目录
        </h2>
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.group}>
              <a
                href={`#group-${g.group}`}
                className="text-sm font-medium text-slate-900 hover:text-indigo-600"
              >
                {g.label}
              </a>
              <span className="ml-2 text-xs text-slate-500">({g.tools.length})</span>
              <ul className="ml-4 mt-1 space-y-0.5">
                {g.tools.map((t) => (
                  <li key={t.name}>
                    <a
                      href={`#tool-${t.name}`}
                      className="font-mono text-xs text-slate-600 hover:text-indigo-600"
                    >
                      {t.name}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      {groups.map((g) => (
        <section key={g.group} className="mb-12">
          <h2
            id={`group-${g.group}`}
            className="mb-2 scroll-mt-6 text-xl font-semibold text-slate-900"
          >
            {g.label}{" "}
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({g.tools.length})
            </span>
          </h2>
          <p className="mb-6 text-sm text-slate-600">{g.subtitle}</p>

          <div className="space-y-5">
            {g.tools.map((t) => (
              <ToolCard key={t.name} tool={t} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

function ToolCard({ tool }: { tool: ToolSpec }) {
  const meta = tool.meta;
  return (
    <article
      id={`tool-${tool.name}`}
      className="scroll-mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="mb-4 flex items-baseline justify-between gap-4 border-b border-slate-100 pb-3">
        <h3 className="font-mono text-lg font-semibold text-slate-900">
          {tool.name}
        </h3>
        {meta && (
          <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {meta.group}
          </span>
        )}
      </header>

      {meta ? (
        <dl className="mb-5 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">调用时机</dt>
          <dd className="text-slate-900">{meta.whenToCall}</dd>

          {meta.callOrder && (
            <>
              <dt className="text-slate-500">顺序约束</dt>
              <dd className="text-amber-700">{meta.callOrder}</dd>
            </>
          )}

          <dt className="text-slate-500">数据来源</dt>
          <dd className="font-mono text-xs text-slate-700">{meta.dataSource}</dd>

          {meta.statuses && meta.statuses.length > 0 && (
            <>
              <dt className="text-slate-500">返回状态</dt>
              <dd>
                {meta.statuses.map((s) => (
                  <code
                    key={s}
                    className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800"
                  >
                    {s}
                  </code>
                ))}
              </dd>
            </>
          )}

          {meta.relatedDocs && meta.relatedDocs.length > 0 && (
            <>
              <dt className="text-slate-500">关联设计</dt>
              <dd>
                {meta.relatedDocs.map((d) => (
                  <code
                    key={d}
                    className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700"
                  >
                    unilume-docs/{d}
                  </code>
                ))}
              </dd>
            </>
          )}
        </dl>
      ) : (
        <p className="mb-5 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⚠️ 缺 <code className="font-mono">TOOL_META</code> 条目, 仅自动可提取信息.
          在 <code className="font-mono">src/lib/tools.ts</code> 的{" "}
          <code className="font-mono">TOOL_META</code> 表中补充.
        </p>
      )}

      <section className="mb-5">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          给 LLM 的 description
        </h4>
        <blockquote className="border-l-2 border-slate-300 pl-3 text-sm leading-relaxed text-slate-700">
          {tool.description}
        </blockquote>
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          入参
        </h4>
        {tool.params.length === 0 ? (
          <p className="text-sm italic text-slate-500">(无参数)</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">字段</th>
                  <th className="py-2 pr-4 font-medium">类型</th>
                  <th className="py-2 pr-4 font-medium">必填</th>
                  <th className="py-2 pr-4 font-medium">默认</th>
                  <th className="py-2 font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                {tool.params.map((p) => (
                  <tr key={p.name} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-4 font-mono text-xs text-slate-900">
                      {p.name}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-700">
                      {p.type}
                    </td>
                    <td className="py-2 pr-4 text-xs text-slate-700">
                      {p.required ? "✓" : "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-700">
                      {p.default === undefined ? "—" : JSON.stringify(p.default)}
                    </td>
                    <td className="py-2 text-xs text-slate-600">
                      {p.description ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </article>
  );
}
