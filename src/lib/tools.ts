import { tool } from "ai";
import { z } from "zod";
import { createVertex } from "@ai-sdk/google-vertex";
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
} from "./market-data";

const vertex = createVertex({
  project: process.env.GOOGLE_VERTEX_PROJECT,
  location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-east5",
  googleAuthOptions: {
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}"),
  },
});

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
        return {
          status: "no_data",
          keyword: normalizedKeyword,
          available_keywords: availableKeywords,
          message: `No market data found for "${normalizedKeyword}". Available keywords: ${availableKeywords.join(", ")}. The crawler may not have scraped this keyword yet.`,
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
};
