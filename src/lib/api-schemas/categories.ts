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

// ── SellerCategory (Phase 2 才有数据) ───────────

export const SellerCategorySchema = z
  .object({
    pk: z.number().int().meta({ description: "Noon Seller Center 主键" }),
    code: z.string(),
    name_en: z.string(),
    level: z.enum(["family", "type", "fulltype"]),
    parent_pk: z.number().int().nullable(),
    is_active: z.boolean(),
  })
  .meta({
    id: "SellerCategory",
    description: "B 端 (seller) 类目, Phase 2 接入 partners-catalogmd-v2 API 才有数据",
  });

export const SellerSearchQuerySchema = z.object({
  q: z.string().trim().min(1).meta({ description: "搜索词, code/name 上 LIKE 匹配" }),
  level: z
    .enum(["family", "type", "fulltype"])
    .optional()
    .meta({ description: "可选, 限定层级" }),
  limit: z.coerce.number().int().min(1).max(100).default(20).meta({
    description: "返回条数, 默认 20, 上限 100",
  }),
});

export const SellerSearchResponseSchema = z
  .object({
    query: z.string(),
    count: z.number().int(),
    results: z.array(SellerCategorySchema),
    note: z
      .string()
      .optional()
      .meta({
        description: "Phase 1 阶段表为空时附带的说明文字",
      }),
  })
  .meta({
    id: "SellerSearchResponse",
  });

// ── GET /api/categories/resolve ───────────────

export const ResolveQuerySchema = z.object({
  side: z.enum(["consumer", "seller"]).meta({
    description: "'consumer' 走 consumer_categories, 'seller' 走 seller_categories",
  }),
  code: z.string().trim().min(1).meta({
    description: "要 resolve 的 code (可能是历史 code, 会查 category_aliases)",
  }),
});

export const CategoryResolveResultSchema = z
  .object({
    status: z.enum(["active", "renamed", "removed", "not_found"]).meta({
      description:
        "active=命中且 is_active=true; renamed=经 alias 查到新 code; removed=命中但 inactive; not_found=完全查不到",
    }),
    side: z.enum(["consumer", "seller"]),
    input_code: z.string(),
    canonical_code: z.string().nullable().meta({
      description: "当前 canonical code; not_found 时为 null",
    }),
    id: z.number().int().optional().meta({
      description: "consumer 侧的 id_category 或 seller 侧的 pk, 命中时返回",
    }),
    name: z.string().optional().meta({ description: "命中时返回的当前名称" }),
    as_of: z.string().meta({ description: "ISO timestamp, 此次解析时刻" }),
  })
  .meta({
    id: "CategoryResolveResult",
    description: "code 解析结果. AI / ERP / listing 历史数据解读必查",
  });

// ── GET /api/categories/map ───────────────────

export const MapQuerySchema = z.object({
  consumer_code: z.string().trim().min(1).meta({
    description: "C 端 slug 路径; 若是 alias 会顺链路找到新 code",
  }),
});

export const CategoryMappingResultSchema = z
  .object({
    status: z.enum(["ok", "no_confirmed_mapping"]).meta({
      description:
        "ok=有可信映射 (high/medium tier); no_confirmed_mapping=Phase 1 默认 / 无映射 / 链路断, AI tool 必须走 concierge 兜底",
    }),
    consumer_code: z.string(),
    seller_pk: z.number().int().optional(),
    seller_code: z.string().optional(),
    tier: z.enum(["high", "medium"]).optional().meta({
      description: "high=auto-confirm; medium=人审通过 (low 不入表)",
    }),
    confidence: z.number().optional(),
    mapped_at: z.string().optional(),
  })
  .meta({
    id: "CategoryMappingResult",
  });
