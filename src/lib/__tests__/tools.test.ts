import { describe, it, expect } from "vitest";
import { policyTools } from "../tools";

describe("policyTools", () => {
  describe("search_policy", () => {
    it("returns expected result structure", async () => {
      const result = await policyTools.search_policy.execute(
        { query: "FBN fees", categories: ["fulfilled_by_noon_fbn"] },
        { toolCallId: "test", messages: [], abortSignal: new AbortController().signal }
      );

      expect(result).toHaveProperty("categories_searched");
      expect(result).toHaveProperty("article_count");
      expect(result).toHaveProperty("failed_count");
      expect(result).toHaveProperty("market_filter");
      expect(result).toHaveProperty("articles");
      expect(result).toHaveProperty("instruction");
    });

    it("returns articles with source URLs in context", async () => {
      const result = await policyTools.search_policy.execute(
        { query: "FBN fees", categories: ["fulfilled_by_noon_fbn"] },
        { toolCallId: "test", messages: [], abortSignal: new AbortController().signal }
      );

      expect(result.articles).toContain("support.noon.partners");
    });

    it("applies market filter", async () => {
      const allResult = await policyTools.search_policy.execute(
        { query: "fees", categories: ["program_policies"] },
        { toolCallId: "test", messages: [], abortSignal: new AbortController().signal }
      );

      const ksaResult = await policyTools.search_policy.execute(
        { query: "fees", market: "KSA", categories: ["program_policies"] },
        { toolCallId: "test", messages: [], abortSignal: new AbortController().signal }
      );

      expect(ksaResult.market_filter).toBe("KSA");
      expect(allResult.market_filter).toBe("ALL");
    });

    it("returns zero failed_count for valid categories", async () => {
      const result = await policyTools.search_policy.execute(
        { query: "returns policy" },
        { toolCallId: "test", messages: [], abortSignal: new AbortController().signal }
      );

      expect(result.failed_count).toBe(0);
      expect(result.article_count).toBeGreaterThan(0);
    });
  });
});
