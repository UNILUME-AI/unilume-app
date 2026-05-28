/**
 * GET /api/categories/resolve
 *
 * 把可能过时的 code resolve 到当前 canonical code, 处理改名/删除场景.
 * 下游 (ERP / listing / 历史爬虫行的解读) 用时务必先 resolve, 不直接信旧 code.
 *
 * Query params:
 *   side  (required) — 'consumer' 或 'seller'
 *   code  (required) — 要 resolve 的 code 字符串
 *
 * 返回:
 *   {
 *     status: 'active' | 'renamed' | 'removed' | 'not_found',
 *     side, input_code, canonical_code, id?, name?, as_of
 *   }
 *
 * 详细设计见 unilume-docs/architecture/crawler/09-category-data-lifecycle.md §3.3
 */

import { resolveCategoryCode } from "@/lib/categories-data";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const side = searchParams.get("side");
  const code = searchParams.get("code");

  if (!side || (side !== "consumer" && side !== "seller")) {
    return Response.json(
      { error: "Missing or invalid parameter: side (must be 'consumer' or 'seller')" },
      { status: 400 },
    );
  }
  if (!code || code.trim().length === 0) {
    return Response.json(
      { error: "Missing required parameter: code" },
      { status: 400 },
    );
  }

  try {
    const result = await resolveCategoryCode(side, code);
    return Response.json(result);
  } catch (error) {
    console.error("[/api/categories/resolve] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
