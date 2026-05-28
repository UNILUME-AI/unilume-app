/**
 * GET /api/market/brands
 *
 * 给定关键词 + 市场的品牌占比分布(top N brands, 各品牌商品数 + 占比 + 平均价).
 *
 * Schema: src/lib/api-schemas/market.ts (OverviewQuerySchema — 共用 keyword+market).
 */

import { getBrandDistribution } from "@/lib/market-data";
import { OverviewQuerySchema } from "@/lib/api-schemas/market";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = OverviewQuerySchema.safeParse(Object.fromEntries(searchParams));

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

  const { keyword, market } = parsed.data;

  try {
    const data = await getBrandDistribution(keyword, market);
    if (!data) {
      return Response.json(
        { error: `No data found for keyword "${keyword}" in ${market}` },
        { status: 404 },
      );
    }
    return Response.json(data);
  } catch (error) {
    console.error("Brand distribution API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
