import { tool } from "ai";
import { z } from "zod";
import { vertex } from "./vertex";
import {
  routeToCategories,
  loadArticles,
  getCategoryList,
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
        .describe(
          `Optional category IDs to search. Available categories: ${getCategoryList()
            .map((c) => `"${c.category_id}" (${c.category_name})`)
            .join(", ")}`
        ),
    }),
    execute: async ({ query, market, categories }) => {
      let formatted: string;
      let articleCount: number;
      let failedCount: number;
      let searchMethod: string;
      let sources: SourceRef[];

      if (hasEmbeddings()) {
        const queryEmbedding = await embedQuery(query);
        const results = semanticSearch(queryEmbedding, 8, market);
        const loaded = loadArticlesByIds(results);
        formatted = loaded.formatted;
        articleCount = loaded.articleCount;
        failedCount = loaded.failedCount;
        sources = loaded.sources;
        searchMethod = "semantic";
      } else {
        const categoryIds = routeToCategories(query, categories);
        const loaded = loadArticles(categoryIds, market);
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
          "Present the available keywords grouped by parent category and subcategory. " +
          "Show the hierarchy: Parent Category → Subcategory → Keywords. " +
          "Show each keyword with its available markets and last updated date. " +
          "This helps users discover what data they can query. " +
          "Suggest the user pick a keyword to analyze further with analyze_market, compare_markets, or analyze_brands.",
      };
    },
  }),
};
