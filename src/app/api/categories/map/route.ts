/**
 * GET /api/categories/map
 *
 * 取 C 端 → B 端类目映射. AI / 上架流程把 consumer code 转换成 seller pk/code.
 *
 * **Phase 1: 永远返回 status='no_confirmed_mapping'** (category_mappings 表 0 行).
 * AI tool 看到该 status 必须走 concierge 兜底, 不得臆造 seller code
 * (设计文档 §7.2 硬规则 4).
 *
 * Schema: src/lib/api-schemas/categories.ts (MapQuerySchema).
 */

import { getCategoryMapping } from "@/lib/categories-data";
import { MapQuerySchema } from "@/lib/api-schemas/categories";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = MapQuerySchema.safeParse(Object.fromEntries(searchParams));

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

  try {
    const result = await getCategoryMapping(parsed.data.consumer_code);
    return Response.json(result);
  } catch (error) {
    console.error("[/api/categories/map] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
