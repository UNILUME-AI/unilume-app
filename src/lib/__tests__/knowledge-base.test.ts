import { describe, it, expect } from "vitest";
import { loadAll, loadArticles, routeToCategories } from "../knowledge-base";

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
});
