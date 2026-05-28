/**
 * GET /api/categories/seller
 *
 * 搜索 B 端 (seller) 类目. **运维/调试用 — 非 AI 常规路径**.
 * AI 该走 /api/categories/map 拿 B 端 code, 而不是自己 free-text 搜.
 *
 * Phase 1: seller_categories 表 0 行 (Phase 2 接入 partners-catalogmd-v2 才有数据).
 *
 * Schema: src/lib/api-schemas/categories.ts (SellerSearchQuerySchema).
 */

import { searchSellerCategories } from "@/lib/categories-data";
import { SellerSearchQuerySchema } from "@/lib/api-schemas/categories";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = SellerSearchQuerySchema.safeParse(
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

  const { q, level, limit } = parsed.data;

  try {
    const results = await searchSellerCategories(q, { level, limit });
    return Response.json({
      query: q,
      count: results.length,
      results,
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
