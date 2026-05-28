/**
 * GET /api/market/compare
 *
 * 跨市场对比 (UAE vs KSA) 给定关键词的指标差异 + AI 偏好建议.
 *
 * Schema: src/lib/api-schemas/market.ts (CompareQuerySchema).
 */

import { getCrossMarketComparison } from "@/lib/market-data";
import { CompareQuerySchema } from "@/lib/api-schemas/market";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = CompareQuerySchema.safeParse(Object.fromEntries(searchParams));

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
    const data = await getCrossMarketComparison(parsed.data.keyword);
    return Response.json(data);
  } catch (error) {
    console.error("Cross-market comparison API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
