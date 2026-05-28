/**
 * GET /api-docs
 *
 * Scalar API Reference 交互式文档, 基于 /api/openapi.json 渲染.
 * 走 CDN 注入 (无 npm 依赖), Scalar 自身就一个 script tag.
 *
 * Scalar > Swagger UI 的理由:
 *   - 原生 OpenAPI 3.1 支持 (Swagger UI 部分功能仍卡在 3.0)
 *   - 内置代码生成 (curl / fetch / axios / python ...)
 *   - 暗黑模式 + 现代搜索
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNILUME API Reference",
  description: "Auto-generated from zod schemas via OpenAPI 3.1",
};

export default function ApiDocsPage() {
  return (
    <>
      <script
        id="api-reference"
        data-url="/api/openapi.json"
        // Scalar 通过 id="api-reference" 找到挂载点, data-url 指向 spec
      />
      <script
        src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
        async
      />
    </>
  );
}
