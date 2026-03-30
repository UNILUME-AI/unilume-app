import { describe, it, expect } from "vitest";
import {
  loadAll,
  loadArticles,
  routeToCategories,
  hasEmbeddings,
  semanticSearch,
  loadArticlesByIds,
} from "../knowledge-base";

describe("knowledge-base", () => {
  describe("loadAll", () => {
    it("loads the index successfully", () => {
      const index = loadAll();
      expect(index.total_count).toBeGreaterThan(0);
      expect(index.categories.length).toBeGreaterThan(0);
      expect(index.documents.length).toBeGreaterThan(0);
    });

    it("returns cached index on second call", () => {
      const first = loadAll();
      const second = loadAll();
      expect(first).toBe(second); // same reference
    });
  });

  describe("routeToCategories", () => {
    it("routes FBN query to fulfilled_by_noon category", () => {
      const categories = routeToCategories("FBN物流费怎么算");
      expect(categories).toContain("fulfilled_by_noon_fbn");
    });

    it("uses explicit categories when provided", () => {
      const categories = routeToCategories("anything", [
        "program_policies",
        "finance_and_payments",
      ]);
      expect(categories).toEqual([
        "program_policies",
        "finance_and_payments",
      ]);
    });

    it("limits to MAX_CATEGORIES (3)", () => {
      const categories = routeToCategories("anything", [
        "a",
        "b",
        "c",
        "d",
      ]);
      expect(categories.length).toBeLessThanOrEqual(3);
    });

    it("falls back to first category when no keywords match", () => {
      const categories = routeToCategories("xyzzy random nonsense 12345");
      expect(categories.length).toBe(1);
    });
  });

  describe("loadArticles", () => {
    it("loads articles for a valid category", () => {
      const result = loadArticles(["fulfilled_by_noon_fbn"]);
      expect(result.articleCount).toBeGreaterThan(0);
      expect(result.formatted.length).toBeGreaterThan(0);
      expect(result.categoryNames).toContain("Fulfilled by noon (FBN)");
      expect(result.failedCount).toBe(0);
    });

    it("returns empty result for unknown category", () => {
      const result = loadArticles(["nonexistent_category"]);
      expect(result.articleCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    it("returns failedCount of 0 when all articles load successfully", () => {
      const result = loadArticles(["fulfilled_by_noon_fbn"]);
      expect(result.failedCount).toBe(0);
      expect(result.articleCount).toBeGreaterThan(0);
    });

    it("respects market filter", () => {
      const allResult = loadArticles(["fulfilled_by_noon_fbn"]);
      const ksaResult = loadArticles(["fulfilled_by_noon_fbn"], "KSA");

      // KSA-filtered should have <= total articles
      expect(ksaResult.articleCount).toBeLessThanOrEqual(
        allResult.articleCount
      );
    });

    it("returns sources array with index, title, url", () => {
      const result = loadArticles(["fulfilled_by_noon_fbn"]);
      expect(result.sources).toBeDefined();
      expect(Array.isArray(result.sources)).toBe(true);

      if (result.sources.length > 0) {
        const source = result.sources[0];
        expect(source).toHaveProperty("index");
        expect(source).toHaveProperty("title");
        expect(source).toHaveProperty("url");
        expect(source.index).toBe(1);
        expect(typeof source.title).toBe("string");
        expect(source.url).toContain("support.noon.partners");
      }
    });

    it("numbers sources sequentially starting from 1", () => {
      const result = loadArticles(["fulfilled_by_noon_fbn"]);
      for (let i = 0; i < result.sources.length; i++) {
        expect(result.sources[i].index).toBe(i + 1);
      }
    });

    it("includes [Source N] labels in formatted text", () => {
      const result = loadArticles(["fulfilled_by_noon_fbn"]);
      if (result.articleCount > 0) {
        expect(result.formatted).toContain("[Source 1]");
      }
    });
  });

  describe("semantic search", () => {
    it("hasEmbeddings returns true when embeddings.json exists", () => {
      expect(hasEmbeddings()).toBe(true);
    });

    it("semanticSearch returns results with valid structure", () => {
      const fs = require("fs");
      const path = require("path");
      const embeddingsPath = path.resolve(process.cwd(), "src/data/policies/embeddings.json");
      const entries = JSON.parse(fs.readFileSync(embeddingsPath, "utf-8"));
      const queryEmbedding = entries[0].embedding;

      const results = semanticSearch(queryEmbedding, 5);
      expect(results.length).toBe(5);
      expect(results[0]).toHaveProperty("id");
      expect(results[0]).toHaveProperty("title");
      expect(results[0]).toHaveProperty("score");
      // First result should be the same article (highest similarity to itself)
      expect(results[0].id).toBe(entries[0].id);
      expect(results[0].score).toBeCloseTo(1.0, 1);
    });

    it("loadArticlesByIds loads articles and returns sources", () => {
      const index = loadAll();
      // Find a real article with a source_url
      const docWithUrl = index.documents.find((d) => d.source_url);
      if (!docWithUrl) return; // skip if no articles have URLs

      const articles = [
        {
          id: docWithUrl.id,
          title: docWithUrl.title,
          filename: docWithUrl.filename,
          source_url: docWithUrl.source_url,
        },
      ];
      const result = loadArticlesByIds(articles);
      expect(result.articleCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].index).toBe(1);
      expect(result.sources[0].title).toBe(docWithUrl.title);
      expect(result.sources[0].url).toBe(docWithUrl.source_url);
    });

    it("loadArticlesByIds skips sources for articles without URLs", () => {
      const articles = [
        { id: "no-url", title: "No URL Article", filename: "Fulfilled_by_noon_FBN/fbn.md" },
      ];
      const result = loadArticlesByIds(articles);
      expect(result.sources).toHaveLength(0);
    });
  });
});
