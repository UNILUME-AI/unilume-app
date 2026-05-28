/**
 * GET /api/market/trend
 *
 * 给定关键词的价格趋势 (回溯 N 天, 默认 7 天, 上限 90).
 *
 * Schema: src/lib/api-schemas/market.ts (TrendQuerySchema).
 */

import { getPriceTrend } from "@/lib/market-data";
import { TrendQuerySchema } from "@/lib/api-schemas/market";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = TrendQuerySchema.safeParse(Object.fromEntries(searchParams));

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
    const data = await getPriceTrend(parsed.data.keyword, parsed.data.days);
    return Response.json(data);
  } catch (error) {
    console.error("Price trend API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
