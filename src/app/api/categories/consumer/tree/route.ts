/**
 * GET /api/categories/consumer/tree
 *
 * 返回 C 端类目嵌套树, 给前端级联选择器 (antd Cascader / Tree) 用.
 *
 * 全树约 6265 个 active 节点 / max depth 6 / gzip 后 ~80KB. 建议前端缓存 1h.
 *
 * Query:
 *   - root      可选, 截取以该 code 为根的子树
 *   - maxDepth  可选, 限制返回深度 (相对 root)
 *   - leafOnly  可选, true 时返回扁平 leaf 数组而非嵌套树 (typeahead 用)
 *   - active    可选 (默认 true)
 *
 * Schema: src/lib/api-schemas/categories.ts (TreeQuerySchema).
 */

import { getConsumerCategoryTree } from "@/lib/categories-data";
import { TreeQuerySchema } from "@/lib/api-schemas/categories";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = TreeQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.map(String).join(".") || "query";
    return Response.json(
      {
        error: `Invalid parameter '${field}': ${issue?.message ?? "validation failed"}`,
        details: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const { root, maxDepth } = parsed.data;
  const leafOnly = parsed.data.leafOnly === "true";
  const active = parsed.data.active === "true";

  try {
    const result = await getConsumerCategoryTree({
      root,
      maxDepth,
      leafOnly,
      active,
    });
    return Response.json(result, {
      headers: {
        // 数据每日 UTC 00:30 更新, 缓存 1h 是安全的
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("[/api/categories/consumer/tree] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
