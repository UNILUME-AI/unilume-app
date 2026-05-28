/**
 * GET /api/categories/consumer
 *
 * Search active C 端 (consumer) categories by code/name.
 * AI 主路径 — Selection Agent 的 category_lookup tool 用此。
 *
 * Query params:
 *   q        (required) — search term, 在 code/name 上 LIKE 匹配
 *   parent   (optional) — 限定 parent_code 精确匹配
 *   active   (optional) — 'true' (默认) / 'false'. false 时返回 inactive 行
 *   limit    (optional) — 默认 20, 上限 100
 *
 * 详细设计见 unilume-docs/architecture/crawler/09-category-data-lifecycle.md §7.1
 */

import { searchConsumerCategories } from "@/lib/categories-data";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const parent = searchParams.get("parent") ?? undefined;
  const activeParam = searchParams.get("active");
  const active = activeParam === null ? true : activeParam !== "false";
  const limitParam = searchParams.get("limit");

  if (!q || q.trim().length === 0) {
    return Response.json(
      { error: "Missing required parameter: q" },
      { status: 400 },
    );
  }

  let limit: number | undefined;
  if (limitParam !== null) {
    const parsed = Number.parseInt(limitParam, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      return Response.json(
        { error: "Invalid parameter: limit must be a positive integer" },
        { status: 400 },
      );
    }
    limit = parsed;
  }

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
