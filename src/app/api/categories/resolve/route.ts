/**
 * GET /api/categories/resolve
 *
 * 把可能过时的 code resolve 到当前 canonical code, 处理改名/删除场景.
 * ERP / listing / 历史数据解读必经此路, 不直接信旧 code.
 *
 * 注意: `not_found` 和 `removed` 都是 HTTP 200 域状态, 不是 HTTP 404.
 * 客户端用 body.status 字段分支.
 *
 * Schema: src/lib/api-schemas/categories.ts (ResolveQuerySchema).
 * 详细设计: unilume-docs/architecture/crawler/09-category-data-lifecycle.md §3.3
 */

import { resolveCategoryCode } from "@/lib/categories-data";
import { ResolveQuerySchema } from "@/lib/api-schemas/categories";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = ResolveQuerySchema.safeParse(Object.fromEntries(searchParams));

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

  try {
    const result = await resolveCategoryCode(parsed.data.side, parsed.data.code);
    return Response.json(result);
  } catch (error) {
    console.error("[/api/categories/resolve] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
