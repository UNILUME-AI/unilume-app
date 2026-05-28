/**
 * Runtime introspection of AI tools registered in tools.ts.
 *
 * 同套 zod-driven 思路:从 tool 对象提取 name / description / inputSchema (zod -> JSON Schema)
 * + TOOL_META 拼成结构化 spec, 供 /ai-tools 页面渲染.
 *
 * 数据源 = src/lib/tools.ts (single source of truth)
 */

import { z } from "zod";
import {
  policyTools,
  marketTools,
  categoryTools,
  TOOL_META,
  type ToolMeta,
  type ToolGroup,
} from "./tools";

export interface ParamSpec {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
  description?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  params: ParamSpec[];
  meta: ToolMeta | null;
}

export interface ToolGroupSection {
  group: ToolGroup | "other";
  label: string;
  tools: ToolSpec[];
}

const GROUP_LABELS: Record<string, string> = {
  category: "Category Tools",
  market: "Market Tools",
  policy: "Policy Tools",
  other: "未分组",
};

const GROUP_ORDER: (ToolGroup | "other")[] = [
  "category",
  "market",
  "policy",
  "other",
];

const GROUP_SUBTITLES: Record<string, string> = {
  category: "Grounding — 把自然语言产品名解析到 Noon canonical category code, 必须先于 market 工具调用",
  market: "选品 / 市场数据 — 价格 / 竞争 / 趋势 / 商品列表 / 品牌分布",
  policy: "知识库 — Noon 卖家政策 / 规则 / 费率 / 流程问答",
  other: "缺 TOOL_META 条目, 仅自动提取信息",
};

/**
 * Build structured spec from runtime tool objects + TOOL_META.
 * Pure function — no IO, no side effects.
 */
export function getToolSpecs(): {
  generatedAt: string;
  totalCount: number;
  groups: { group: ToolGroup | "other"; label: string; subtitle: string; tools: ToolSpec[] }[];
} {
  const all = { ...policyTools, ...marketTools, ...categoryTools };
  const entries: ToolSpec[] = Object.entries(all).map(([name, t]) => {
    // Vercel AI SDK 的 Tool<...> 是泛型, 我们只读 description + inputSchema, 走 unknown 中转
    const tool = t as unknown as {
      description?: string;
      inputSchema?: z.ZodTypeAny;
    };
    return {
      name,
      description: tool.description ?? "(no description)",
      params: extractParams(tool.inputSchema),
      meta: TOOL_META[name] ?? null,
    };
  });

  const byGroup = new Map<string, ToolSpec[]>();
  for (const e of entries) {
    const g = e.meta?.group ?? "other";
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(e);
  }

  const groups = GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
    group: g,
    label: GROUP_LABELS[g],
    subtitle: GROUP_SUBTITLES[g],
    tools: byGroup.get(g)!,
  }));

  return {
    generatedAt: new Date().toISOString(),
    totalCount: entries.length,
    groups,
  };
}

// ── Param extraction (zod -> JSON Schema -> table) ──────

function extractParams(inputSchema: z.ZodTypeAny | undefined): ParamSpec[] {
  if (!inputSchema) return [];
  let jsonSchema: Record<string, unknown>;
  try {
    jsonSchema = z.toJSONSchema(inputSchema) as Record<string, unknown>;
  } catch {
    return [];
  }
  const props = (jsonSchema.properties as Record<string, Record<string, unknown>>) || {};
  const required = new Set((jsonSchema.required as string[]) || []);

  return Object.entries(props).map(([name, prop]) => ({
    name,
    type: describeType(prop),
    // 有 default 视作 optional (zod parse 时会填默认值, 但输入层语义是可省略)
    required: required.has(name) && !("default" in prop),
    default: prop.default,
    description: prop.description as string | undefined,
  }));
}

function describeType(prop: Record<string, unknown>): string {
  const t = prop.type;
  if (Array.isArray(prop.enum)) {
    return `enum (${(prop.enum as string[]).map((v) => `"${v}"`).join(" | ")})`;
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
