/**
 * GET /api/openapi.json
 *
 * 返回 UNILUME App 自有 API 的 OpenAPI 3.1 spec.
 * 任何 OpenAPI 工具 (Postman / Insomnia / Scalar / Swagger UI / SDK 生成器) 都能消费.
 *
 * Spec 是从 src/lib/api-schemas/registry.ts 静态生成的, 改 schema 后无需重启.
 */

import { generateOpenApiSpec } from "@/lib/api-schemas/registry";

export async function GET() {
  const spec = generateOpenApiSpec();
  return Response.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
