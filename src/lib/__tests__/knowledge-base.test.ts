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
  });

  describe("semantic search", () => {
    it("hasEmbeddings returns true when embeddings.json exists", () => {
      expect(hasEmbeddings()).toBe(true);
    });

    it("semanticSearch returns results with valid structure", () => {
      // Use a real embedding from the first entry as a test query vector
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

    it("loadArticlesByIds loads articles correctly", () => {
      const articles = [
        { id: "fbn", title: "FBN", filename: "Fulfilled_by_noon_FBN/fbn.md" },
      ];
      const result = loadArticlesByIds(articles);
      expect(result.articleCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.formatted).toContain("FBN");
    });
  });
});
