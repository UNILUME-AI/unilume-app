/**
 * GET /api/market/keywords
 *
 * 列出当前有市场数据的关键词 + 按类目分组. 用于市场看板侧栏 / 关键词选择器.
 *
 * 无 query 参数. 响应见 KeywordsResponseSchema.
 */

import { getAvailableKeywords, getKeywordCategories } from "@/lib/market-data";

export async function GET() {
  try {
    const [keywords, categories] = await Promise.all([
      getAvailableKeywords(),
      getKeywordCategories(),
    ]);
    return Response.json({ keywords, categories });
  } catch (error) {
    console.error("Keywords API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
