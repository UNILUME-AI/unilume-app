/**
 * GET /api/market/products
 *
 * 给定关键词 + 市场的商品列表 (前 N 条, 可按 position/price/rating 排序).
 *
 * Schema: src/lib/api-schemas/market.ts (ProductsQuerySchema).
 */

import { getProductList } from "@/lib/market-data";
import { ProductsQuerySchema } from "@/lib/api-schemas/market";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = ProductsQuerySchema.safeParse(Object.fromEntries(searchParams));

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

  const { keyword, market, sortBy } = parsed.data;
  // 保留旧行为: 大 limit 静默 clamp 到 100 (不返 400)
  const limit = Math.min(parsed.data.limit, 100);

  try {
    const products = await getProductList(keyword, market, sortBy, limit);
    return Response.json({
      keyword,
      market,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Product list API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
