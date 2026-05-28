/**
 * GET /api/categories/seller
 *
 * Search B 端 (seller) categories by code/name.
 * **运维/调试用 — 非 AI 常规路径**. AI 该走 /api/categories/map 拿 B 端 code,
 * 而不是自己 free-text 搜卖家类目 (设计 §7.2 硬规则 2).
 *
 * Phase 1: seller_categories 表 0 行 (Phase 2 用 partners-catalogmd-v2 API 填充).
 *   端点存在但 results 为空, 调用方拿到稳定空响应不会 404.
 *
 * Query params:
 *   q       (required) — search term
 *   level   (optional) — 'family' / 'type' / 'fulltype' 精确过滤
 *   limit   (optional) — 默认 20, 上限 100
 */

import { searchSellerCategories } from "@/lib/categories-data";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const level = searchParams.get("level") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  if (!q || q.trim().length === 0) {
    return Response.json(
      { error: "Missing required parameter: q" },
      { status: 400 },
    );
  }

  try {
    const results = await searchSellerCategories(q, { level, limit });

    return Response.json({
      query: q,
      count: results.length,
      results,
      // 提示调用方: Phase 1 阶段表是空的
      note:
        results.length === 0
          ? "B 端 taxonomy 数据将在 Phase 2 接入 (partners-catalogmd-v2/get-taxonomy)"
          : undefined,
    });
  } catch (error) {
    console.error("[/api/categories/seller] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
