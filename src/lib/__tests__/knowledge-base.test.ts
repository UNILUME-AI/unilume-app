import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the neon SQL tagged-template function
const mockSql = vi.fn();
vi.mock("@neondatabase/serverless", () => ({
  neon: () => mockSql,
}));

import {
  getCategoryList,
  routeToCategories,
  hasEmbeddings,
  semanticSearch,
  loadArticlesByIds,
  loadArticles,
} from "../knowledge-base";

beforeEach(() => {
  mockSql.mockReset();
});

describe("knowledge-base", () => {
  describe("getCategoryList", () => {
    it("returns category rows with article_count and total_chars", async () => {
      const mockRows = [
        {
          category_id: "fbn",
          category_name: "Fulfilled by Noon",
          description: "FBN docs",
          keywords: ["fbn", "fulfilled"],
          article_count: 5,
          total_chars: 12000,
        },
        {
          category_id: "payments",
          category_name: "Finance & Payments",
          description: "Payment docs",
          keywords: ["payment", "finance"],
          article_count: 3,
          total_chars: 8000,
        },
      ];
      mockSql.mockResolvedValueOnce(mockRows);

      const result = await getCategoryList();
      expect(result).toHaveLength(2);
      expect(result[0].category_id).toBe("fbn");
      expect(result[0].article_count).toBe(5);
      expect(result[0].total_chars).toBe(12000);
      expect(result[1].category_id).toBe("payments");
    });
  });

  describe("routeToCategories", () => {
    it("returns explicit categories directly without DB call", async () => {
      const result = await routeToCategories("anything", [
        "program_policies",
        "finance_and_payments",
      ]);
      expect(result).toEqual(["program_policies", "finance_and_payments"]);
      expect(mockSql).not.toHaveBeenCalled();
    });

    it("limits explicit categories to MAX_CATEGORIES (3)", async () => {
      const result = await routeToCategories("anything", [
        "a",
        "b",
        "c",
        "d",
      ]);
      expect(result).toHaveLength(3);
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("matches keywords from mocked categories", async () => {
      mockSql.mockResolvedValueOnce([
        {
          category_id: "fbn",
          category_name: "Fulfilled by Noon",
          description: "",
          keywords: ["fbn", "fulfilled by noon"],
          article_count: 5,
          total_chars: 12000,
        },
        {
          category_id: "payments",
          category_name: "Finance",
          description: "",
          keywords: ["payment", "finance"],
          article_count: 3,
          total_chars: 8000,
        },
      ]);

      const result = await routeToCategories("FBN物流费怎么算");
      expect(result).toContain("fbn");
    });

    it("falls back to first category when no keywords match", async () => {
      mockSql.mockResolvedValueOnce([
        {
          category_id: "fbn",
          category_name: "Fulfilled by Noon",
          description: "",
          keywords: ["fbn"],
          article_count: 10,
          total_chars: 20000,
        },
        {
          category_id: "payments",
          category_name: "Finance",
          description: "",
          keywords: ["payment"],
          article_count: 3,
          total_chars: 8000,
        },
      ]);

      const result = await routeToCategories("xyzzy random nonsense 12345");
      expect(result).toHaveLength(1);
      expect(result[0]).toBe("fbn");
    });
  });

  describe("hasEmbeddings", () => {
    it("returns true when embeddings exist", async () => {
      mockSql.mockResolvedValueOnce([{ has: true }]);
      const result = await hasEmbeddings();
      expect(result).toBe(true);
    });

    it("returns false when no embeddings exist", async () => {
      mockSql.mockResolvedValueOnce([{ has: false }]);
      const result = await hasEmbeddings();
      expect(result).toBe(false);
    });
  });

  describe("semanticSearch", () => {
    it("returns results ordered by score, limited to topK", async () => {
      const mockRows = [
        { id: "a1", title: "Article A", filename: "a.md", source_url: "https://example.com/a", score: 0.95 },
        { id: "a2", title: "Article B", filename: "b.md", source_url: "https://example.com/b", score: 0.85 },
        { id: "a3", title: "Article C", filename: "c.md", source_url: null, score: 0.75 },
        { id: "a4", title: "Article D", filename: "d.md", source_url: null, score: 0.65 },
        { id: "a5", title: "Article E", filename: "e.md", source_url: null, score: 0.55 },
        { id: "a6", title: "Article F", filename: "f.md", source_url: null, score: 0.45 },
      ];
      mockSql.mockResolvedValueOnce(mockRows);

      const queryEmbedding = [0.1, 0.2, 0.3];
      const results = await semanticSearch(queryEmbedding, 3);

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe("a1");
      expect(results[0].score).toBe(0.95);
      expect(results[0].title).toBe("Article A");
      expect(results[0].filename).toBe("a.md");
      expect(results[0].source_url).toBe("https://example.com/a");
      expect(results[2].id).toBe("a3");
    });

    it("returns results with valid structure", async () => {
      mockSql.mockResolvedValueOnce([
        { id: "x1", title: "Test", filename: "test.md", source_url: "https://example.com", score: 0.9 },
      ]);

      const results = await semanticSearch([0.1], 5);
      expect(results[0]).toHaveProperty("id");
      expect(results[0]).toHaveProperty("title");
      expect(results[0]).toHaveProperty("filename");
      expect(results[0]).toHaveProperty("score");
    });
  });

  describe("loadArticlesByIds", () => {
    it("loads articles and returns formatted output with title and content", async () => {
      mockSql.mockResolvedValueOnce([
        {
          id: "art1",
          title: "FBN Guide",
          content: "This is FBN content.",
          category_name: "Fulfilled by Noon",
          source_url: "https://support.noon.partners/fbn",
          modified_time: "2025-01-01",
        },
      ]);

      const articles = [
        { id: "art1", title: "FBN Guide", filename: "fbn.md", source_url: "https://support.noon.partners/fbn" },
      ];
      const result = await loadArticlesByIds(articles);

      expect(result.articleCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.formatted).toContain("FBN Guide");
      expect(result.formatted).toContain("This is FBN content.");
      expect(result.formatted).toContain("[Source 1]");
    });

    it("returns source refs for articles with URLs", async () => {
      mockSql.mockResolvedValueOnce([
        {
          id: "art1",
          title: "FBN Guide",
          content: "Content here.",
          category_name: "FBN",
          source_url: "https://support.noon.partners/fbn",
          modified_time: "2025-01-01",
        },
      ]);

      const articles = [
        { id: "art1", title: "FBN Guide", filename: "fbn.md", source_url: "https://support.noon.partners/fbn" },
      ];
      const result = await loadArticlesByIds(articles);

      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].index).toBe(1);
      expect(result.sources[0].title).toBe("FBN Guide");
      expect(result.sources[0].url).toBe("https://support.noon.partners/fbn");
    });

    it("skips sources for articles without URLs", async () => {
      mockSql.mockResolvedValueOnce([
        {
          id: "no-url",
          title: "No URL Article",
          content: "Some content.",
          category_name: "General",
          source_url: null,
          modified_time: null,
        },
      ]);

      const articles = [
        { id: "no-url", title: "No URL Article", filename: "nourl.md" },
      ];
      const result = await loadArticlesByIds(articles);

      expect(result.articleCount).toBe(1);
      expect(result.sources).toHaveLength(0);
    });

    it("increments failedCount for missing articles", async () => {
      mockSql.mockResolvedValueOnce([]);

      const articles = [
        { id: "missing", title: "Missing", filename: "missing.md" },
      ];
      const result = await loadArticlesByIds(articles);

      expect(result.articleCount).toBe(0);
      expect(result.failedCount).toBe(1);
    });
  });

  describe("loadArticles", () => {
    it("loads articles for a category and formats them", async () => {
      mockSql.mockResolvedValueOnce([
        {
          id: "a1",
          title: "FBN Shipping",
          content: "Shipping details for FBN.",
          category_id: "fbn",
          category_name: "Fulfilled by Noon (FBN)",
          char_count: 25,
          source_url: "https://support.noon.partners/fbn-shipping",
          modified_time: "2025-01-15",
        },
        {
          id: "a2",
          title: "FBN Fees",
          content: "Fee structure for FBN.",
          category_id: "fbn",
          category_name: "Fulfilled by Noon (FBN)",
          char_count: 21,
          source_url: "https://support.noon.partners/fbn-fees",
          modified_time: "2025-02-01",
        },
      ]);

      const result = await loadArticles(["fbn"]);

      expect(result.articleCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.categoryNames).toContain("Fulfilled by Noon (FBN)");
      expect(result.formatted).toContain("[Source 1]");
      expect(result.formatted).toContain("[Source 2]");
      expect(result.formatted).toContain("FBN Shipping");
      expect(result.formatted).toContain("FBN Fees");
      expect(result.formatted).toContain("Shipping details for FBN.");
    });

    it("returns empty result for unknown category", async () => {
      mockSql.mockResolvedValueOnce([]);

      const result = await loadArticles(["nonexistent_category"]);
      expect(result.articleCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    it("returns sources with sequential indices starting from 1", async () => {
      mockSql.mockResolvedValueOnce([
        {
          id: "a1",
          title: "Article 1",
          content: "Content 1",
          category_id: "cat1",
          category_name: "Cat",
          char_count: 9,
          source_url: "https://example.com/1",
          modified_time: null,
        },
        {
          id: "a2",
          title: "Article 2",
          content: "Content 2",
          category_id: "cat1",
          category_name: "Cat",
          char_count: 9,
          source_url: "https://example.com/2",
          modified_time: null,
        },
      ]);

      const result = await loadArticles(["cat1"]);
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].index).toBe(1);
      expect(result.sources[1].index).toBe(2);
    });

    it("respects market filter", async () => {
      mockSql.mockResolvedValueOnce([
        {
          id: "a1",
          title: "FBN KSA Guide",
          content: "KSA specific content.",
          category_id: "fbn",
          category_name: "FBN",
          char_count: 21,
          source_url: null,
          modified_time: null,
        },
        {
          id: "a2",
          title: "FBN UAE Guide",
          content: "UAE specific content.",
          category_id: "fbn",
          category_name: "FBN",
          char_count: 21,
          source_url: null,
          modified_time: null,
        },
        {
          id: "a3",
          title: "FBN General Info",
          content: "General content.",
          category_id: "fbn",
          category_name: "FBN",
          char_count: 16,
          source_url: null,
          modified_time: null,
        },
      ]);

      const result = await loadArticles(["fbn"], "KSA");

      // Market filter keeps KSA-titled and general (no market keywords) articles,
      // excludes UAE-titled articles
      expect(result.articleCount).toBe(2);
      expect(result.formatted).toContain("FBN KSA Guide");
      expect(result.formatted).toContain("FBN General Info");
      expect(result.formatted).not.toContain("FBN UAE Guide");
    });
  });
});
