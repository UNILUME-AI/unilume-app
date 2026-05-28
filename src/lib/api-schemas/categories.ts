/**
 * Zod schemas for /api/categories/* endpoints.
 *
 * 这是 single source of truth:
 *   - route handler 用它做运行时校验 (替代手写 if (!q))
 *   - z.toJSONSchema() 用它生成 OpenAPI 3.1 spec
 *   - TypeScript 类型从同一份 schema 推导 (z.infer<typeof X>)
 *
 * 修改 schema 后, 文档 / 校验 / 类型三者自动同步.
 */

import { z } from "zod";

// ── 共享 ──────────────────────────────────────

export const ErrorResponseSchema = z
  .object({
    error: z.string().meta({ description: "人类可读的错误消息" }),
    details: z
      .array(z.unknown())
      .optional()
      .meta({ description: "结构化错误明细 (zod issues 等)" }),
  })
  .meta({
    id: "ErrorResponse",
    description: "标准错误响应",
  });

// ── ConsumerCategory ──────────────────────────

export const ConsumerCategorySchema = z
  .object({
    id_category: z
      .number()
      .int()
      .meta({ description: "Noon 全平台稳定主键, 跨地域一致", examples: [31234] }),
    code: z.string().meta({
      description: "slug 路径, 改名时更新 (旧 code 进 category_aliases)",
      examples: ["home-and-kitchen"],
    }),
    name: z.string().meta({ examples: ["Home & Kitchen"] }),
    parent_code: z.string().nullable(),
    depth: z.number().int().nullable(),
    is_active: z.boolean(),
    is_leaf: z.boolean(),
    seen_in_locales: z
      .array(z.string())
      .meta({ description: "见于哪些 locale", examples: [["ae", "sa"]] }),
    first_seen: z.string().meta({ description: "ISO date" }),
    last_seen: z.string().meta({ description: "ISO date" }),
    liveness: z.enum(["alive", "dead", "unknown"]),
  })
  .meta({
    id: "ConsumerCategory",
    description: "C 端 (consumer) 类目当前态",
  });

export type ConsumerCategory = z.infer<typeof ConsumerCategorySchema>;

// ── GET /api/categories/consumer ─────────────

export const ConsumerSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .meta({
      description: "搜索词, 在 code/name 上 LIKE 匹配 (大小写不敏感, 前后空白会被 trim)",
      examples: ["home", "phone"],
    }),
  parent: z
    .string()
    .optional()
    .meta({ description: "限定 parent_code 精确匹配" }),
  active: z
    .enum(["true", "false"])
    .default("true")
    .meta({
      description: "只返回 active 类目 (默认 'true'). 字符串值, 在 route 内转 boolean.",
    }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .meta({ description: "返回条数, 默认 20, 上限 100" }),
});

export const ConsumerSearchResponseSchema = z
  .object({
    query: z.string(),
    count: z.number().int(),
    results: z.array(ConsumerCategorySchema),
  })
  .meta({
    id: "ConsumerSearchResponse",
    description: "搜索结果 (count = results.length)",
  });
