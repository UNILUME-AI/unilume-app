import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the data layer — tool just delegates to searchConsumerCategories
vi.mock("@/lib/categories-data", () => ({
  searchConsumerCategories: vi.fn(),
}));

import { categoryTools } from "../tools";
import { searchConsumerCategories } from "@/lib/categories-data";

const mockSearch = vi.mocked(searchConsumerCategories);

const mockToolContext = {
  toolCallId: "test",
  messages: [],
  abortSignal: new AbortController().signal,
};

function makeCategory(overrides: Partial<{ id_category: number; code: string; name: string; depth: number; is_leaf: boolean; seen_in_locales: string[]; last_seen: string }> = {}) {
  return {
    id_category: 31234,
    code: "home-and-kitchen",
    name: "Home & Kitchen",
    parent_code: null,
    depth: 1,
    is_active: true,
    is_leaf: false,
    seen_in_locales: ["ae", "sa"],
    first_seen: "2026-05-01",
    last_seen: "2026-05-28",
    liveness: "alive" as const,
    ...overrides,
  };
}

describe("categoryTools.category_lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns status='ok' with up to 5 candidates on match", async () => {
    mockSearch.mockResolvedValue([
      makeCategory({ id_category: 1, code: "phones", name: "Phones" }),
      makeCategory({ id_category: 2, code: "phones/cases", name: "Cases", depth: 2, parent_code: "phones" }),
      makeCategory({ id_category: 3, code: "phones/chargers", name: "Chargers", depth: 2, parent_code: "phones" }),
    ]);

    const result = await categoryTools.category_lookup.execute!(
      { query: "phone" },
      mockToolContext,
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.match_count).toBe(3);
      expect(result.candidates).toHaveLength(3);
      expect(result.candidates[0].code).toBe("phones");
      expect(result.instruction).toMatch(/code/i);
    }
  });

  it("truncates to 5 candidates even when more match", async () => {
    mockSearch.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) =>
        makeCategory({ id_category: i + 1, code: `cat-${i}`, name: `Category ${i}` }),
      ),
    );

    const result = await categoryTools.category_lookup.execute!(
      { query: "x" },
      mockToolContext,
    );

    if (result.status === "ok") {
      expect(result.match_count).toBe(8);
      expect(result.candidates).toHaveLength(5);
    }
  });

  it("normalizes query (lowercase + trim) before passing to data layer", async () => {
    mockSearch.mockResolvedValue([]);

    await categoryTools.category_lookup.execute!(
      { query: "  Phone Case  " },
      mockToolContext,
    );

    expect(mockSearch).toHaveBeenCalledWith("phone case", {
      active: true,
      limit: 10,
    });
  });

  it("filters by market='UAE' via seen_in_locales", async () => {
    mockSearch.mockResolvedValue([
      makeCategory({ id_category: 1, code: "ae-only", seen_in_locales: ["ae"] }),
      makeCategory({ id_category: 2, code: "sa-only", seen_in_locales: ["sa"] }),
      makeCategory({ id_category: 3, code: "both", seen_in_locales: ["ae", "sa"] }),
    ]);

    const result = await categoryTools.category_lookup.execute!(
      { query: "x", market: "UAE" },
      mockToolContext,
    );

    if (result.status === "ok") {
      expect(result.candidates.map((c) => c.code).sort()).toEqual(
        ["ae-only", "both"].sort(),
      );
    }
  });

  it("filters by market='KSA' via seen_in_locales", async () => {
    mockSearch.mockResolvedValue([
      makeCategory({ id_category: 1, code: "ae-only", seen_in_locales: ["ae"] }),
      makeCategory({ id_category: 3, code: "both", seen_in_locales: ["ae", "sa"] }),
    ]);

    const result = await categoryTools.category_lookup.execute!(
      { query: "x", market: "KSA" },
      mockToolContext,
    );

    if (result.status === "ok") {
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].code).toBe("both");
    }
  });

  it("returns status='no_match' when search returns empty", async () => {
    mockSearch.mockResolvedValue([]);

    const result = await categoryTools.category_lookup.execute!(
      { query: "ghost-product" },
      mockToolContext,
    );

    expect(result.status).toBe("no_match");
    if (result.status === "no_match") {
      expect(result.reason).toBe("no_match");
      expect(result.instruction).toMatch(/不要|代码|code/i);
    }
  });

  it("returns status='no_match' with reason='found_but_not_in_X' when market filter empties", async () => {
    mockSearch.mockResolvedValue([
      makeCategory({ id_category: 1, code: "ae-only", seen_in_locales: ["ae"] }),
    ]);

    const result = await categoryTools.category_lookup.execute!(
      { query: "x", market: "KSA" },
      mockToolContext,
    );

    expect(result.status).toBe("no_match");
    if (result.status === "no_match") {
      expect(result.reason).toBe("found_but_not_in_KSA");
      expect(result.message).toMatch(/KSA/);
    }
  });

  it("instruction explicitly forbids inventing codes", async () => {
    mockSearch.mockResolvedValue([makeCategory()]);
    const result = await categoryTools.category_lookup.execute!(
      { query: "x" },
      mockToolContext,
    );

    if (result.status === "ok") {
      // 中文检查: "不要凭记忆生成 code"
      expect(result.instruction).toMatch(/不要|never/i);
      expect(result.instruction.toLowerCase()).toContain("code");
    }
  });
});
