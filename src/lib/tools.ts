import { tool } from "ai";
import { z } from "zod";
import { routeToCategories, loadArticles, getCategoryList } from "./knowledge-base";

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
      const categoryIds = routeToCategories(query, categories);
      const { formatted, articleCount, categoryNames, failedCount } = loadArticles(
        categoryIds,
        market
      );

      return {
        categories_searched: categoryNames.join(", "),
        article_count: articleCount,
        failed_count: failedCount,
        market_filter: market || "ALL",
        articles: formatted,
        instruction:
          "Answer the user's question based ONLY on the documents above. " +
          "Cite source document titles when referencing specific information. " +
          "If the documents do not contain the answer, clearly state that the information is not available in the current knowledge base. " +
          "Always mention which market(s) (KSA/UAE/Egypt) a policy applies to when relevant.",
      };
    },
  }),
};
