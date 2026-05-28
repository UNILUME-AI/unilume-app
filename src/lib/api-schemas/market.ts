/**
 * Zod schemas for /api/market/* endpoints.
 *
 * Mirror types defined in src/lib/market-data.ts:
 *   MarketOverview / PriceTrend / KeywordInfo / CrossMarketComparison /
 *   ProductListItem / BrandDistribution / CategoryGroup
 *
 * 改 schema 时务必和 market-data.ts 同步.
 */

import { z } from "zod";

// ── Shared query params ──────────────────────

const MarketEnum = z
  .enum(["UAE", "KSA"])
  .default("UAE")
  .meta({ description: "市场代码; UAE 或 KSA, 默认 UAE" });

const KeywordParam = z
  .string()
  .trim()
  .min(1)
  .meta({ description: "搜索关键词", examples: ["bluetooth speaker"] });

// ── Reusable sub-schemas ─────────────────────

const TopSellerSchema = z.object({
  name: z.string(),
  count: z.number().int(),
});

// ── MarketOverview ───────────────────────────

export const MarketOverviewSchema = z
  .object({
    keyword: z.string(),
    market: z.string(),
    total_results: z.number().int().meta({
      description: "Noon 该关键词搜索结果总数 (展示条数, 非全量)",
    }),
    price_median: z.number(),
    price_p25: z.number(),
    price_p75: z.number(),
    price_min: z.number(),
    price_max: z.number(),
    avg_rating: z.number(),
    avg_review_count: z.number(),
    sponsored_pct: z.number().meta({ description: "Sponsored 商品占比 0-1" }),
    fulfilled_pct: z.number().meta({ description: "Noon Fulfilled 占比 0-1" }),
    product_count: z.number().int().meta({ description: "样本商品数" }),
    top_sellers: z.array(TopSellerSchema),
    data_freshness: z.string().meta({ description: "最近一次快照的 ISO timestamp" }),
  })
  .meta({ id: "MarketOverview" });

export const OverviewQuerySchema = z.object({
  keyword: KeywordParam,
  market: MarketEnum,
});

// ── PriceTrend ───────────────────────────────

export const PriceTrendPointSchema = z
  .object({
    date: z.string().meta({ description: "ISO date (YYYY-MM-DD)" }),
    median: z.number(),
    p25: z.number().nullable(),
    p75: z.number().nullable(),
  })
  .meta({ id: "PriceTrendPoint" });

export const PriceTrendSchema = z
  .object({
    keyword: z.string(),
    days: z.number().int(),
    data_points: z.number().int().meta({
      description: "有效数据点数 (低于 days 当数据缺失)",
    }),
    daily: z.array(PriceTrendPointSchema),
    direction: z.enum(["rising", "falling", "stable", "unknown"]),
    change_pct: z.number().nullable().meta({
      description: "区间总体涨跌幅 (decimal, 0.1 = +10%)",
    }),
    latest_median: z.number(),
  })
  .meta({ id: "PriceTrend" });

export const TrendQuerySchema = z.object({
  keyword: KeywordParam,
  days: z.coerce.number().int().min(1).max(90).default(7).meta({
    description: "回溯天数, 默认 7, 上限 90",
  }),
});

// ── Keywords + CategoryGroup ─────────────────

export const KeywordInfoSchema = z
  .object({
    keyword: z.string(),
    markets: z.array(z.string()),
    last_updated: z.string(),
  })
  .meta({ id: "KeywordInfo" });

export const CategoryGroupSchema = z
  .object({
    parent_code: z.string(),
    parent_name: z.string(),
    subcategories: z.array(
      z.object({
        code: z.string(),
        name: z.string(),
        keywords: z.array(z.string()),
      }),
    ),
  })
  .meta({ id: "CategoryGroup" });

export const KeywordsResponseSchema = z
  .object({
    keywords: z.array(KeywordInfoSchema),
    categories: z.array(CategoryGroupSchema),
  })
  .meta({ id: "KeywordsResponse" });

// ── CrossMarketComparison ────────────────────

export const CrossMarketComparisonSchema = z
  .object({
    keyword: z.string(),
    uae: MarketOverviewSchema.nullable(),
    ksa: MarketOverviewSchema.nullable(),
    deltas: z.object({
      price_median: z.number().nullable(),
      total_results: z.number().nullable(),
      avg_rating: z.number().nullable(),
      sponsored_pct: z.number().nullable(),
    }),
    recommendation: z.string().meta({
      description: "AI 给出的市场偏好建议(短文本)",
    }),
  })
  .meta({ id: "CrossMarketComparison" });

export const CompareQuerySchema = z.object({
  keyword: KeywordParam,
});

// ── ProductList ─────────────────────────────

export const ProductListItemSchema = z
  .object({
    sku: z.string(),
    title: z.string(),
    brand: z.string(),
    price_current: z.number(),
    price_original: z.number().nullable(),
    discount_pct: z.number().nullable(),
    rating: z.number().nullable(),
    review_count: z.number().int(),
    seller_name: z.string(),
    is_sponsored: z.boolean(),
    is_fulfilled: z.boolean(),
    position: z.number().int().meta({ description: "在搜索结果页的位置 1-based" }),
    image_url: z.string().nullable(),
  })
  .meta({ id: "ProductListItem" });

export const ProductsQuerySchema = z.object({
  keyword: KeywordParam,
  market: MarketEnum,
  sortBy: z
    .enum(["position", "price_current", "rating", "review_count", "discount_pct"])
    .default("position")
    .meta({ description: "排序列, 跟数据库列名一致" }),
  // limit 用 clamp 行为 (旧 route 用 Math.min, 测试依赖), 不在 schema 设 max
  limit: z.coerce.number().int().min(1).default(20).meta({
    description: "返回条数, 默认 20. 大于 100 会被 server clamp 到 100",
  }),
});

export const ProductsResponseSchema = z
  .object({
    keyword: z.string(),
    market: z.string(),
    count: z.number().int(),
    products: z.array(ProductListItemSchema),
  })
  .meta({ id: "ProductsResponse" });

// ── BrandDistribution ────────────────────────

export const BrandShareSchema = z
  .object({
    brand: z.string(),
    count: z.number().int(),
    share_pct: z.number().meta({ description: "占比 0-100 (百分比)" }),
    avg_price: z.number(),
  })
  .meta({ id: "BrandShare" });

export const BrandDistributionSchema = z
  .object({
    keyword: z.string(),
    market: z.string(),
    total_products: z.number().int(),
    brands: z.array(BrandShareSchema),
  })
  .meta({ id: "BrandDistribution" });
