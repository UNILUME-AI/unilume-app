/**
 * Generate a Markdown API reference by scanning src/app/api/**\/route.ts.
 *
 * 输入: file path -> URL (Next.js App Router 约定, [param] -> {param})
 * 输入: 文件顶部第一个 /** ... *\/ JSDoc 块 -> route 描述
 * 输入: `export async function GET|POST|...` -> HTTP method 列表
 *
 * 用法:
 *   npx tsx scripts/docs/generate-api-docs.ts             # 写到默认输出
 *   npx tsx scripts/docs/generate-api-docs.ts --check     # 只校验, CI 用
 *
 * 没有 JSDoc 的 route 会输出 "⚠️ Needs documentation" 占位 + 推断的 query/method,
 * 既不阻塞构建, 又给出后续补注释的待办清单.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── 配置 ─────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const API_ROOT = path.join(REPO_ROOT, "src", "app", "api");
const DEFAULT_OUTPUT = path.resolve(
  REPO_ROOT,
  "..",
  "unilume-docs",
  "architecture",
  "app",
  "api-reference.md",
);

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

interface RouteInfo {
  filePath: string; // 相对 repo root
  urlPath: string; // e.g. /api/categories/consumer
  methods: HttpMethod[];
  jsdoc: string | null; // 原始 JSDoc 块 (已剥外壳)
  hasDoc: boolean;
}

// ── 主流程 ───────────────────────────────────────────

async function main() {
  const args = new Set(process.argv.slice(2));
  const checkOnly = args.has("--check");

  const routeFiles = await findRouteFiles(API_ROOT);
  const routes: RouteInfo[] = [];
  for (const file of routeFiles) {
    routes.push(await analyzeRoute(file));
  }
  routes.sort((a, b) => a.urlPath.localeCompare(b.urlPath));

  const md = renderMarkdown(routes);

  if (checkOnly) {
    const missing = routes.filter((r) => !r.hasDoc);
    if (missing.length > 0) {
      console.log(
        `⚠️  ${missing.length} route(s) 缺 JSDoc 头注释 (--check 模式):`,
      );
      for (const r of missing) {
        console.log(`   - ${r.urlPath}  (${r.filePath})`);
      }
    } else {
      console.log("✓ 所有 route 都有 JSDoc 注释");
    }
    process.exit(missing.length > 0 ? 1 : 0);
  }

  await fs.mkdir(path.dirname(DEFAULT_OUTPUT), { recursive: true });
  await fs.writeFile(DEFAULT_OUTPUT, md, "utf-8");

  const documented = routes.filter((r) => r.hasDoc).length;
  console.log(`✓ Wrote ${DEFAULT_OUTPUT}`);
  console.log(
    `  ${routes.length} routes total, ${documented} documented, ${
      routes.length - documented
    } need JSDoc`,
  );
}

// ── 扫描 / 解析 ──────────────────────────────────────

async function findRouteFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "__tests__" || ent.name === "node_modules") continue;
        await walk(full);
      } else if (ent.isFile() && ent.name === "route.ts") {
        out.push(full);
      }
    }
  }
  await walk(root);
  return out;
}

async function analyzeRoute(filePath: string): Promise<RouteInfo> {
  const content = await fs.readFile(filePath, "utf-8");
  const rel = path.relative(REPO_ROOT, filePath);

  return {
    filePath: rel,
    urlPath: filePathToUrl(filePath),
    methods: extractMethods(content),
    jsdoc: extractTopJsdoc(content),
    hasDoc: !!extractTopJsdoc(content),
  };
}

/** src/app/api/foo/[id]/bar/route.ts -> /api/foo/{id}/bar */
function filePathToUrl(filePath: string): string {
  const rel = path.relative(path.join(REPO_ROOT, "src", "app"), filePath);
  const segments = rel
    .split(path.sep)
    .slice(0, -1) // 去掉 route.ts
    .map((seg) => {
      // [param] -> {param}; [...param] -> {param} (catch-all 暂作普通 param)
      if (seg.startsWith("[") && seg.endsWith("]")) {
        return "{" + seg.slice(1, -1).replace(/^\.{3}/, "") + "}";
      }
      // (group) Route Groups 不出现在 URL
      if (seg.startsWith("(") && seg.endsWith(")")) return null;
      return seg;
    })
    .filter((s): s is string => s !== null);
  return "/" + segments.join("/");
}

function extractMethods(content: string): HttpMethod[] {
  const found: HttpMethod[] = [];
  for (const m of HTTP_METHODS) {
    // 匹配 `export async function GET(`, `export function GET(`, `export const GET =`
    const re = new RegExp(
      `export\\s+(?:async\\s+)?(?:function|const)\\s+${m}\\b`,
    );
    if (re.test(content)) found.push(m);
  }
  return found;
}

/** 文件顶部第一个 /** ... *\/ 块 (出现在任何 import/code 之前). */
function extractTopJsdoc(content: string): string | null {
  // 跳过 shebang / 空行 / 单行 //
  const trimmed = content.replace(/^(\s*(?:\/\/[^\n]*\n|\n))*/, "");
  const m = trimmed.match(/^\/\*\*([\s\S]*?)\*\//);
  if (!m) return null;
  // 剥每行前缀 ` *` 和首尾空行
  const inner = m[1]
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, ""))
    .join("\n")
    .trim();
  return inner || null;
}

// ── Markdown 渲染 ───────────────────────────────────

function renderMarkdown(routes: RouteInfo[]): string {
  const now = new Date().toISOString().slice(0, 10);
  const documented = routes.filter((r) => r.hasDoc).length;

  const lines: string[] = [];
  lines.push("# UNILUME App API Reference");
  lines.push("");
  lines.push(
    `> 自动生成于 ${now} - 共 ${routes.length} 个 route, ${documented} 个有 JSDoc.`,
  );
  lines.push(
    "> 不要手工编辑此文件 - 修改 `src/app/api/**/route.ts` 顶部 JSDoc 后跑 `npm run docs:api` 重生成.",
  );
  lines.push("");
  lines.push("## 目录");
  lines.push("");

  // 按 URL 前缀(/api/foo)分组
  const groups = new Map<string, RouteInfo[]>();
  for (const r of routes) {
    const prefix = "/" + r.urlPath.split("/").slice(1, 3).join("/");
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix)!.push(r);
  }

  for (const [prefix, group] of groups) {
    lines.push(`- **${prefix}**`);
    for (const r of group) {
      const anchor = r.urlPath.replace(/[\/{}]/g, "-").replace(/^-+/, "");
      const methodTag = r.methods.length > 0 ? r.methods.join(" / ") : "?";
      const docFlag = r.hasDoc ? "" : " ⚠️";
      lines.push(`  - [${methodTag} ${r.urlPath}](#${anchor})${docFlag}`);
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const r of routes) {
    const anchor = r.urlPath.replace(/[\/{}]/g, "-").replace(/^-+/, "");
    const methodTag = r.methods.length > 0 ? r.methods.join(" / ") : "(no exports detected)";
    lines.push(`## \`${methodTag}\` ${r.urlPath}`);
    lines.push("");
    lines.push(`<a id="${anchor}"></a>`);
    lines.push("");
    lines.push(`**File:** \`${r.filePath}\``);
    lines.push("");

    if (r.hasDoc) {
      lines.push(r.jsdoc!);
    } else {
      lines.push("> ⚠️ **Needs documentation** - file 缺顶部 `/** ... */` JSDoc 块.");
      lines.push("");
      lines.push("建议补充: 路径用途 / Query params / Body / Response shape / Error codes / Auth 要求.");
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

// ── Entry ────────────────────────────────────────────

main().catch((err) => {
  console.error("✗ generate-api-docs failed:", err);
  process.exit(1);
});
