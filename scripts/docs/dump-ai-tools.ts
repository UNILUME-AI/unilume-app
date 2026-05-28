/**
 * Generate a Markdown reference for AI tools by introspecting src/lib/tools.ts.
 *
 * 提取每个 tool 的:
 *   - name (object key)
 *   - description (tool.description)
 *   - inputSchema -> z.toJSONSchema 拆成参数表
 *   - has execute (sanity check)
 *
 * 配合 TOOL_META 表 (在 tools.ts 同文件) 拿到:
 *   - group / dataSource / whenToCall / statuses / callOrder / relatedDocs
 *
 * 用法:
 *   npx tsx scripts/docs/dump-ai-tools.ts          # 写到默认输出
 *   npx tsx scripts/docs/dump-ai-tools.ts --check  # 只校验 (CI 用)
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  policyTools,
  marketTools,
  categoryTools,
  TOOL_META,
  type ToolMeta,
} from "../../src/lib/tools";

// ── Config ───────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_OUTPUT = path.resolve(
  REPO_ROOT,
  "..",
  "unilume-docs",
  "architecture",
  "app",
  "ai-tools.md",
);

const GROUP_LABELS: Record<string, string> = {
  category: "Category Tools(grounding,先于 market 工具)",
  market: "Market Tools(选品 / 市场数据)",
  policy: "Policy Tools(知识库 / 政策问答)",
};
const GROUP_ORDER = ["category", "market", "policy"];

// ── Main ─────────────────────────────────────

interface ToolEntry {
  name: string;
  description: string;
  paramsTable: ParamRow[];
  hasExecute: boolean;
  meta: ToolMeta | null;
}

interface ParamRow {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
  description?: string;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const checkOnly = args.has("--check");

  const all = { ...policyTools, ...marketTools, ...categoryTools };
  const entries: ToolEntry[] = Object.entries(all).map(([name, t]) => {
    const tool = t as {
      description?: string;
      inputSchema?: z.ZodTypeAny;
      execute?: unknown;
    };
    return {
      name,
      description: tool.description ?? "(no description)",
      paramsTable: extractParams(tool.inputSchema),
      hasExecute: typeof tool.execute === "function",
      meta: TOOL_META[name] ?? null,
    };
  });

  // Check: 任何 tool 没在 TOOL_META 里就报警
  const missingMeta = entries.filter((e) => !e.meta);
  if (checkOnly && missingMeta.length > 0) {
    console.log(`⚠️  ${missingMeta.length} tool(s) 缺 TOOL_META 条目:`);
    for (const m of missingMeta) console.log(`   - ${m.name}`);
    process.exit(1);
  }

  const md = renderMarkdown(entries);

  if (checkOnly) {
    // diff 模式: 比较现有文件
    try {
      const existing = await fs.readFile(DEFAULT_OUTPUT, "utf-8");
      if (existing.trim() !== md.trim()) {
        console.log(
          "✗ ai-tools.md 与 src/lib/tools.ts 不同步. 跑 npm run docs:tools 重生成.",
        );
        process.exit(1);
      }
    } catch {
      console.log("✗ ai-tools.md 不存在. 跑 npm run docs:tools 生成.");
      process.exit(1);
    }
    console.log("✓ ai-tools.md 已同步");
    return;
  }

  await fs.mkdir(path.dirname(DEFAULT_OUTPUT), { recursive: true });
  await fs.writeFile(DEFAULT_OUTPUT, md, "utf-8");

  const withMeta = entries.filter((e) => e.meta).length;
  console.log(`✓ Wrote ${DEFAULT_OUTPUT}`);
  console.log(
    `  ${entries.length} tools total, ${withMeta} with metadata, ${entries.length - withMeta} need TOOL_META entry`,
  );
}

// ── Param extraction ─────────────────────────

function extractParams(inputSchema: z.ZodTypeAny | undefined): ParamRow[] {
  if (!inputSchema) return [];
  let jsonSchema: Record<string, unknown>;
  try {
    jsonSchema = z.toJSONSchema(inputSchema) as Record<string, unknown>;
  } catch (e) {
    console.warn("[warn] toJSONSchema failed:", (e as Error).message);
    return [];
  }
  const props = (jsonSchema.properties as Record<string, Record<string, unknown>>) || {};
  const required = new Set((jsonSchema.required as string[]) || []);

  return Object.entries(props).map(([name, prop]) => ({
    name,
    type: describeType(prop),
    // 有 default 视作 optional (跟 OpenAPI dump 同惯例): zod parse 时会填 default,
    // 但输入层 "客户端可省略" 才是文档语义.
    required: required.has(name) && !("default" in prop),
    default: prop.default,
    description: prop.description as string | undefined,
  }));
}

function describeType(prop: Record<string, unknown>): string {
  const t = prop.type;
  if (Array.isArray(prop.enum)) {
    return `enum (${(prop.enum as string[]).map((v) => `\`${v}\``).join(" \\| ")})`;
  }
  if (typeof t === "string") {
    if (t === "array") {
      const items = prop.items as Record<string, unknown> | undefined;
      return `array of ${items ? describeType(items) : "any"}`;
    }
    return t;
  }
  if (prop.anyOf) return "union";
  return "any";
}

// ── Markdown rendering ───────────────────────

function renderMarkdown(entries: ToolEntry[]): string {
  const now = new Date().toISOString().slice(0, 10);

  // Group entries
  const byGroup = new Map<string, ToolEntry[]>();
  for (const e of entries) {
    const g = e.meta?.group ?? "other";
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(e);
  }

  const lines: string[] = [];
  lines.push("# UNILUME AI Tools 参考");
  lines.push("");
  lines.push(
    `> 自动生成于 ${now} · 共 ${entries.length} 个 tool · 数据源: \`src/lib/tools.ts\` (description + inputSchema + TOOL_META)`,
  );
  lines.push(
    "> 不要手工编辑此文件 — 改 `src/lib/tools.ts` 后跑 `npm run docs:tools` 重生成.",
  );
  lines.push("");

  // Index
  lines.push("## 目录");
  lines.push("");
  for (const g of GROUP_ORDER) {
    const items = byGroup.get(g);
    if (!items) continue;
    lines.push(`- **${GROUP_LABELS[g] ?? g}** (${items.length})`);
    for (const e of items) {
      lines.push(`  - [${e.name}](#${e.name.replace(/_/g, "_")})`);
    }
  }
  // Any "other" group
  const other = byGroup.get("other");
  if (other && other.length > 0) {
    lines.push(`- **未分组 ⚠️** (${other.length}, 缺 TOOL_META)`);
    for (const e of other) lines.push(`  - ${e.name}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Per-tool sections
  for (const g of GROUP_ORDER) {
    const items = byGroup.get(g);
    if (!items) continue;
    lines.push(`## ${GROUP_LABELS[g] ?? g}`);
    lines.push("");
    for (const e of items) lines.push(...renderTool(e));
  }
  // Other group at the end
  if (other) {
    lines.push("## 未分组 ⚠️");
    lines.push("");
    lines.push("以下 tool 缺 `TOOL_META` 条目,请在 `src/lib/tools.ts` 补充.");
    lines.push("");
    for (const e of other) lines.push(...renderTool(e));
  }

  return lines.join("\n");
}

function renderTool(e: ToolEntry): string[] {
  const lines: string[] = [];
  lines.push(`### \`${e.name}\``);
  lines.push("");

  if (e.meta) {
    lines.push(`**调用时机:** ${e.meta.whenToCall}`);
    if (e.meta.callOrder) lines.push(`**顺序约束:** ${e.meta.callOrder}`);
    lines.push(`**数据来源:** ${e.meta.dataSource}`);
    if (e.meta.statuses && e.meta.statuses.length > 0) {
      lines.push(
        `**返回状态:** ${e.meta.statuses.map((s) => `\`${s}\``).join(" / ")}`,
      );
    }
    if (e.meta.relatedDocs && e.meta.relatedDocs.length > 0) {
      lines.push(
        `**关联设计:** ${e.meta.relatedDocs.map((d) => `\`unilume-docs/${d}\``).join(", ")}`,
      );
    }
    lines.push("");
  } else {
    lines.push("> ⚠️ 缺 `TOOL_META` 条目, 仅自动可提取信息");
    lines.push("");
  }

  // Description (LLM-facing)
  lines.push("**给 LLM 的 description**:");
  lines.push("");
  lines.push(`> ${e.description.replace(/\n/g, "\n> ")}`);
  lines.push("");

  // Params table
  lines.push("**入参**:");
  lines.push("");
  if (e.paramsTable.length === 0) {
    lines.push("(无参数)");
  } else {
    lines.push("| 字段 | 类型 | 必填 | 默认 | 说明 |");
    lines.push("|------|------|------|------|------|");
    for (const p of e.paramsTable) {
      const def =
        p.default === undefined
          ? "—"
          : typeof p.default === "string"
            ? `\`${p.default}\``
            : `\`${JSON.stringify(p.default)}\``;
      lines.push(
        `| \`${p.name}\` | ${p.type} | ${p.required ? "✓" : "—"} | ${def} | ${p.description ?? ""} |`,
      );
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  return lines;
}

// ── Entry ────────────────────────────────────

main().catch((err) => {
  console.error("✗ dump-ai-tools failed:", err);
  process.exit(1);
});
