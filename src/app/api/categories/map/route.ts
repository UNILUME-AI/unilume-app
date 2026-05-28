/**
 * GET /api/categories/map
 *
 * 取 C 端 → B 端类目映射. AI / 上架流程用此把 consumer code 转换成 seller pk/code.
 *
 * **Phase 1: category_mappings 表 0 行**, 永远返回 status='no_confirmed_mapping'.
 * AI tool 看到该 status 该走 concierge 兜底, 不要臆造 seller code (设计 §7.2 硬规则 4).
 *
 * Phase 2 起会基于 consumer_id_category 命中 mapping (含 tier high/medium).
 *
 * Query params:
 *   consumer_code   (required) — C 端 slug 路径
 *
 * 返回:
 *   {status: 'ok', consumer_code, seller_pk, seller_code, tier, confidence, mapped_at}
 *   或
 *   {status: 'no_confirmed_mapping', consumer_code}
 */

import { getCategoryMapping } from "@/lib/categories-data";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const consumerCode = searchParams.get("consumer_code");

  if (!consumerCode || consumerCode.trim().length === 0) {
    return Response.json(
      { error: "Missing required parameter: consumer_code" },
      { status: 400 },
    );
  }

  try {
    const result = await getCategoryMapping(consumerCode);
    return Response.json(result);
  } catch (error) {
    console.error("[/api/categories/map] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
