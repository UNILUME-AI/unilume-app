/**
 * GET /api/categories/consumer
 *
 * 搜索 C 端 (consumer) 类目. AI Selection Agent 的 category_lookup tool 主路径.
 *
 * 参数 / 响应 schema 定义在 src/lib/api-schemas/categories.ts (是文档的 source of truth).
 * 端到端文档见 /api-docs (基于 /api/openapi.json 渲染).
 *
 * 设计文档: unilume-docs/architecture/crawler/09-category-data-lifecycle.md §7.1
 */

import { searchConsumerCategories } from "@/lib/categories-data";
import { ConsumerSearchQuerySchema } from "@/lib/api-schemas/categories";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = ConsumerSearchQuerySchema.safeParse(
    Object.fromEntries(searchParams),
  );

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.join(".") || "query";
    return Response.json(
      {
        error: `Invalid parameter '${field}': ${issue?.message ?? "validation failed"}`,
        details: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const { q, parent, active: activeStr, limit } = parsed.data;
  const active = activeStr === "true";

  try {
    const results = await searchConsumerCategories(q, { parent, active, limit });
    return Response.json({
      query: q,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("[/api/categories/consumer] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
