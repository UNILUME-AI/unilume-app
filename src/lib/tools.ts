import { tool } from "ai";
import { z } from "zod";
import { vertex } from "./vertex";
import {
  routeToCategories,
  loadArticles,
  hasEmbeddings,
  semanticSearch,
  loadArticlesByIds,
  type SourceRef,
} from "./knowledge-base";
import {
  getMarketOverview,
  getPriceTrend,
  getCompetitionAnalysis,
  getAvailableKeywords,
  getCrossMarketComparison,
  getProductList,
  getBrandDistribution,
  getKeywordCategories,
} from "./market-data";
import { searchConsumerCategories } from "./categories-data";

async function embedQuery(query: string): Promise<number[]> {
  const model = vertex.textEmbeddingModel("text-embedding-005");
  const { embeddings } = await model.doEmbed({ values: [query] });
  return embeddings[0];
}

export const policyTools = {
  search_policy: tool({
    description:
      "Search Noon seller policies and documentation. Use this tool when the user asks about Noon rules, policies, fees, procedures, requirements, returns, fulfillment, onboarding, or any operational questions about selling on Noon.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("The user's question about Noon policies, rephrased as a clear search query"),
      market: z
        .enum(["KSA", "UAE", "Egypt"])
        .optional()
        .describe("Optional market filter to prioritize market-specific documents"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Optional category IDs to narrow search scope"),
    }),
    execute: async ({ query, market, categories }) => {
      let formatted: string;
      let articleCount: number;
      let failedCount: number;
      let searchMethod: string;
      let sources: SourceRef[];

      if (await hasEmbeddings()) {
        const queryEmbedding = await embedQuery(query);
        const results = await semanticSearch(queryEmbedding, 8, market);
        const loaded = await loadArticlesByIds(results);
        formatted = loaded.formatted;
        articleCount = loaded.articleCount;
        failedCount = loaded.failedCount;
        sources = loaded.sources;
        searchMethod = "semantic";
      } else {
        const categoryIds = await routeToCategories(query, categories);
        const loaded = await loadArticles(categoryIds, market);
        formatted = loaded.formatted;
        articleCount = loaded.articleCount;
        failedCount = loaded.failedCount;
        sources = loaded.sources;
        searchMethod = "keyword";
      }

      return {
        search_method: searchMethod,
        article_count: articleCount,
        failed_count: failedCount,
        market_filter: market || "ALL",
        articles: formatted,
        sources,
        instruction:
          "Answer the user's question based ONLY on the documents above. " +
          "CITATION FORMAT: Use numbered markers 【1】【2】【3】 to cite sources inline. " +
          "Each number corresponds to the [Source N] label in the documents above. " +
          "Place the marker immediately after the relevant statement. " +
          "Do NOT use markdown links [title](url) for citations — only use 【N】 markers. " +
          "If the documents do not contain the answer, clearly state that the information is not available in the current knowledge base. " +
          "Always mention which market(s) (KSA/UAE/Egypt) a policy applies to when relevant.",
      };
    },
  }),
};

export const marketTools = {
  analyze_market: tool({
    description:
      "Analyze Noon marketplace data for a product keyword. Use this tool when the user asks about market demand, competition, pricing, price trends, whether a product category is worth entering, or any product selection (选品) questions.",
    inputSchema: z.object({
      keyword: z
        .string()
        .describe(
          "Product keyword to analyze in English, e.g. 'air fryer', 'phone case', 'wireless earbuds'"
        ),
      market: z
        .enum(["UAE", "KSA", "Egypt"])
        .optional()
        .default("UAE")
        .describe("Target market (default: UAE)"),
    }),
    execute: async ({ keyword, market }) => {
      const normalizedKeyword = keyword.toLowerCase().trim();
      const targetMarket = market || "UAE";

      const [overview, trend, competition, availableKeywords] = await Promise.all([
        getMarketOverview(normalizedKeyword, targetMarket),
        getPriceTrend(normalizedKeyword, 7),
        getCompetitionAnalysis(normalizedKeyword),
        getAvailableKeywords(),
      ]);

      if (!overview) {
        const keywordStrings = availableKeywords.map((k) => k.keyword);
        return {
          status: "no_data",
          keyword: normalizedKeyword,
          available_keywords: keywordStrings,
          message: `No market data found for "${normalizedKeyword}". Available keywords: ${keywordStrings.join(", ")}. The crawler may not have scraped this keyword yet.`,
        };
      }

      return {
        status: "ok",
        keyword: normalizedKeyword,
        market: targetMarket,
        data_freshness: overview.data_freshness,

        // Market size
        total_results: overview.total_results,
        product_count: overview.product_count,

        // Pricing
        price_median: overview.price_median,
        price_p25: overview.price_p25,
        price_p75: overview.price_p75,
        price_min: overview.price_min,
        price_max: overview.price_max,
        currency: "AED",

        // Price trend
        price_trend_direction: trend.direction,
        price_trend_change_pct: trend.change_pct,
        price_trend_days: trend.data_points,
        price_trend_daily: trend.daily,

        // Competition
        avg_rating: overview.avg_rating,
        avg_review_count: overview.avg_review_count,
        sponsored_pct: overview.sponsored_pct,
        fulfilled_pct: overview.fulfilled_pct,
        unique_sellers: competition?.unique_sellers ?? 0,
        top_sellers: overview.top_sellers,
        top10_share_pct: competition?.top10_share_pct ?? 0,
        entry_barrier: competition?.entry_barrier ?? "unknown",

        instruction:
          "不要使用【N】引用角标。" +
          "Analyze this market data and provide a clear recommendation in the user's language. " +
          "Structure your response as: 1) Market Overview (demand + price range), " +
          "2) Competition Analysis (barriers, top sellers), " +
          "3) Price Trend, " +
          "4) Recommendation (是否值得进入 / worth entering). " +
          "Use specific numbers from the data. If price_trend_days < 3, note that trend data is limited.",
      };
    },
  }),

  compare_markets: tool({
    description:
      "Compare the same product keyword across UAE and KSA markets. Use when the user asks which market is better, compares two markets, or asks about cross-market differences.",
    inputSchema: z.object({
      keyword: z
        .string()
        .describe("Product keyword to compare across markets, e.g. 'air fryer'"),
    }),
    execute: async ({ keyword }) => {
      const result = await getCrossMarketComparison(keyword.toLowerCase().trim());

      return {
        ...result,
        instruction:
          "不要使用【N】引用角标。" +
          "Present a side-by-side comparison table of UAE vs KSA for this keyword. " +
          "Include columns for: price median, total results, avg rating, sponsored %, and any other available metrics. " +
          "Highlight the key differences using the deltas provided. " +
          "End with a clear recommendation on which market looks more favorable and why.",
      };
    },
  }),

  list_products: tool({
    description:
      "List individual products for a keyword with details. Use when the user asks to see specific products, top sellers, or wants to browse listings.",
    inputSchema: z.object({
      keyword: z
        .string()
        .describe("Product keyword to list products for"),
      market: z
        .enum(["UAE", "KSA", "Egypt"])
        .optional()
        .default("UAE")
        .describe("Target market (default: UAE)"),
      sort_by: z
        .enum(["position", "price_current", "rating", "review_count"])
        .optional()
        .default("position")
        .describe("Sort order for product list (default: position)"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Number of products to return (default: 10, max: 20)"),
    }),
    execute: async ({ keyword, market, sort_by, limit }) => {
      const products = await getProductList(
        keyword.toLowerCase().trim(),
        market || "UAE",
        sort_by || "position",
        Math.min(limit || 10, 20)
      );

      return {
        keyword: keyword.toLowerCase().trim(),
        market: market || "UAE",
        sort_by: sort_by || "position",
        count: products.length,
        products,
        instruction:
          "不要使用【N】引用角标。" +
          "Present the product list in a clear table format. " +
          "Include columns for: position/rank, title (truncated if long), brand, price, rating, review count, and whether it's sponsored/fulfilled. " +
          "If the list is empty, inform the user that no products were found for this keyword.",
      };
    },
  }),

  analyze_brands: tool({
    description:
      "Analyze brand distribution and market share for a keyword. Use when the user asks about brand competition, white-label opportunities, or brand landscape.",
    inputSchema: z.object({
      keyword: z
        .string()
        .describe("Product keyword to analyze brand distribution for"),
      market: z
        .enum(["UAE", "KSA", "Egypt"])
        .optional()
        .default("UAE")
        .describe("Target market (default: UAE)"),
    }),
    execute: async ({ keyword, market }) => {
      const targetMarket = market || "UAE";
      const result = await getBrandDistribution(keyword.toLowerCase().trim(), targetMarket);

      if (!result) {
        const availableKeywords = await getAvailableKeywords();
        const keywordStrings = availableKeywords.map((k) => k.keyword);
        return {
          status: "no_data",
          keyword: keyword.toLowerCase().trim(),
          market: targetMarket,
          available_keywords: keywordStrings,
          message: `No brand data found for "${keyword.toLowerCase().trim()}" in ${targetMarket}.`,
        };
      }

      return {
        status: "ok",
        ...result,
        instruction:
          "不要使用【N】引用角标。" +
          "Present the brand distribution as a ranked list or table. " +
          "Show each brand's product count, market share %, and average price. " +
          "Highlight if there are many 'Unbranded' products (white-label opportunity). " +
          "Summarize the competitive landscape: is it dominated by a few brands or fragmented?",
      };
    },
  }),

  browse_keywords: tool({
    description:
      "List all available keywords that have market data, optionally grouped by category. Use when the user wants to explore what data is available or browse categories.",
    inputSchema: z.object({}),
    execute: async () => {
      const [keywords, categories] = await Promise.all([
        getAvailableKeywords(),
        getKeywordCategories(),
      ]);

      return {
        total_keywords: keywords.length,
        keywords,
        categories: categories.map(cat => ({
          parent: cat.parent_name,
          subcategories: cat.subcategories.map(sub => ({
            name: sub.name,
            keywords: sub.keywords,
          })),
        })),
        instruction:
          "不要使用【N】引用角标。" +
          "Present the available keywords grouped by parent category and subcategory. " +
          "Show the hierarchy: Parent Category → Subcategory → Keywords. " +
          "Show each keyword with its available markets and last updated date. " +
          "This helps users discover what data they can query. " +
          "Suggest the user pick a keyword to analyze further with analyze_market, compare_markets, or analyze_brands.",
      };
    },
  }),
};

// ── Category lookup (Selection Agent 主路径) ──────────

export const categoryTools = {
  category_lookup: tool({
    description:
      "Resolve a natural-language product term to a valid Noon consumer category code. " +
      "ALWAYS call this BEFORE calling analyze_market / compare_markets / list_products / analyze_brands " +
      "when the user mentions a product or category (例如 '挂脖风扇', '手机壳', 'air fryer'). " +
      "Returns the canonical id_category + slug + parent + last_seen date. " +
      "**Never invent category codes** — only use what this tool returns. " +
      "Query MUST be in English; if the user's term is Chinese / Arabic, translate it first " +
      "(Noon category names are all English).",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Product / category term in English, e.g. 'neck fan', 'phone case', 'air fryer'. " +
            "Translate non-English user input before calling.",
        ),
      market: z
        .enum(["UAE", "KSA"])
        .optional()
        .describe(
          "Optional market hint — filters to categories that have been seen in that locale " +
            "(UAE → 'ae', KSA → 'sa'). Omit to search across all locales.",
        ),
    }),
    execute: async ({ query, market }) => {
      const normalized = query.toLowerCase().trim();
      const results = await searchConsumerCategories(normalized, {
        active: true,
        limit: 10,
      });

      // Market filter via seen_in_locales (post-filter, search already small)
      let filtered = results;
      if (market) {
        const locale = market === "UAE" ? "ae" : "sa";
        filtered = results.filter((c) => c.seen_in_locales.includes(locale));
      }

      if (filtered.length === 0) {
        const reason =
          results.length === 0
            ? "no_match"
            : `found_but_not_in_${market}`;
        return {
          status: "no_match" as const,
          query: normalized,
          market: market ?? "any",
          reason,
          message:
            results.length > 0 && market
              ? `Found ${results.length} matches in other markets but none in ${market}.`
              : "No matching categories found in Noon's taxonomy.",
          instruction:
            "不要使用【N】引用角标。" +
            "告诉用户没有匹配到 Noon 上的类目, 并给两个具体后续: " +
            "1) 改用更宽泛的英文词 (例如不要用 '挂脖小风扇' 这种具体描述, 用 'fan' 'cooling fan'). " +
            "2) 或者用户可以描述场景, 我们换更上层的关键词. " +
            "**绝对不要凭记忆生成 category code 或继续调用 analyze_market 等工具**.",
        };
      }

      return {
        status: "ok" as const,
        query: normalized,
        market: market ?? "any",
        match_count: filtered.length,
        candidates: filtered.slice(0, 5).map((c) => ({
          id_category: c.id_category,
          code: c.code,
          name: c.name,
          parent_code: c.parent_code,
          depth: c.depth,
          is_leaf: c.is_leaf,
          seen_in_locales: c.seen_in_locales,
          last_seen: c.last_seen,
        })),
        instruction:
          "不要使用【N】引用角标。" +
          "用第一个候选作为主答案, 引用 code + name + (As of <last_seen>). " +
          "如果用户问市场/价格/竞争, 拿候选的 code 调用 analyze_market 等工具 " +
          "(注意: market 工具用的是 keyword 不是 code, 但 code 通常含可用作 keyword 的英文词). " +
          "**绝对不要凭记忆生成 code 或翻译 code**. " +
          "如果第一个候选 depth 较浅 (例如 depth=1 或 2), 可能是父类目, 简要告诉用户" +
          "'这是一个较宽泛的类目, 你具体想做哪一种?' 然后让用户选更精确的子类目.",
      };
    },
  }),
};

// ── Tool metadata for auto-generated docs (npm run docs:tools) ──
//
// 跟 tool 定义放同一文件, 改 tool 时一眼看到 meta 在旁边, 不容易漏更新.
// dump-ai-tools.ts 扫描这个表 + 每个 tool 的 description/inputSchema 生成 markdown.

export type ToolGroup = "policy" | "market" | "category";

export interface ToolMeta {
  group: ToolGroup;
  dataSource: string;
  whenToCall: string;
  /** Possible string values returned in `status` field; empty if tool has no status enum. */
  statuses?: string[];
  /** Optional ordering constraint, e.g. "必须先于 market 工具" */
  callOrder?: string;
  /** Related design docs (relative paths under unilume-docs/). */
  relatedDocs?: string[];
}

export const TOOL_META: Record<string, ToolMeta> = {
  search_policy: {
    group: "policy",
    dataSource:
      "kb_articles + pgvector embeddings (semantic) / kb_categories (keyword fallback)",
    whenToCall:
      "用户问 Noon 政策 / 规则 / 费率 / 流程 / 退货 / 物流 / 入驻要求等",
    relatedDocs: ["architecture/intelligence/04-policy-agent.md"],
  },

  analyze_market: {
    group: "market",
    dataSource: "market_snapshots + market_products tables",
    whenToCall:
      "用户问市场需求 / 竞争密度 / 价格分布 / 价格趋势 / 选品是否值得",
    statuses: ["ok", "no_data"],
    callOrder: "应在 category_lookup 之后调用 (用 canonical code 当 keyword)",
    relatedDocs: ["architecture/intelligence/01-architecture.md"],
  },

  compare_markets: {
    group: "market",
    dataSource: "market_snapshots (UAE + KSA 跨市场)",
    whenToCall: "用户问跨市场对比, 哪个市场更值得做",
    callOrder: "应在 category_lookup 之后调用",
    relatedDocs: ["architecture/intelligence/01-architecture.md"],
  },

  list_products: {
    group: "market",
    dataSource: "market_products table",
    whenToCall: "用户要看具体商品 / top sellers / 浏览 listings",
    callOrder: "应在 category_lookup 之后调用",
  },

  analyze_brands: {
    group: "market",
    dataSource: "market_products aggregated by brand",
    whenToCall: "用户问品牌竞争格局 / 白牌 (unbranded) 机会",
    statuses: ["ok", "no_data"],
    callOrder: "应在 category_lookup 之后调用",
  },

  browse_keywords: {
    group: "market",
    dataSource: "market_snapshots distinct keywords + kb_categories grouping",
    whenToCall: "用户想浏览有哪些可分析的关键词 / 数据探索",
  },

  category_lookup: {
    group: "category",
    dataSource:
      "consumer_categories table (LIKE on code/name, optional seen_in_locales filter)",
    whenToCall:
      "用户提产品 / 类目时 (例如 '挂脖风扇' / '手机壳' / 'air fryer')",
    statuses: ["ok", "no_match"],
    callOrder:
      "**必须先于** analyze_market / compare_markets / list_products / analyze_brands; query 必须为英文 (LLM 翻译后再调)",
    relatedDocs: ["architecture/crawler/09-category-data-lifecycle.md"],
  },
};
