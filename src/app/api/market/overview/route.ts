/**
 * GET /api/market/overview
 *
 * 一个关键词在指定市场的概览(价格分布 / 评分 / sponsored 比例 / top sellers).
 * 用于市场看板首屏 + Selection Agent 决策输入.
 *
 * Schema: src/lib/api-schemas/market.ts (OverviewQuerySchema).
 */

import { getMarketOverview } from "@/lib/market-data";
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
    const data = await getMarketOverview(keyword, market);
    if (!data) {
      return Response.json(
        { error: `No data found for keyword "${keyword}" in ${market}` },
        { status: 404 },
      );
    }
    return Response.json(data);
  } catch (error) {
    console.error("Market overview API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
