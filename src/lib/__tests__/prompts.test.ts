import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock @neondatabase/serverless before importing prompts
vi.mock("@neondatabase/serverless", () => {
  const mockSql = vi.fn().mockImplementation(() =>
    Promise.resolve([
      {
        category_id: "program_policies",
        category_name: "Program Policies",
        description: "Noon seller program policies and rules",
        keywords: ["policy", "program"],
        article_count: 50,
        total_chars: 100000,
      },
      {
        category_id: "fulfilled_by_noon_fbn",
        category_name: "Fulfilled by Noon (FBN)",
        description: "FBN fulfillment service documentation",
        keywords: ["fbn", "fulfillment"],
        article_count: 173,
        total_chars: 200000,
      },
    ])
  );
  // neon() returns a tagged-template sql function
  return {
    neon: vi.fn(() => mockSql),
  };
});

import { buildSystemPrompt } from "../prompts";

describe("buildSystemPrompt", () => {
  let prompt: string;

  beforeAll(async () => {
    prompt = await buildSystemPrompt();
  });

  it("includes article count", () => {
    expect(prompt).toContain("223");
  });

  it("identifies as Noon seller operations assistant", () => {
    expect(prompt).toContain("卖家运营助手");
  });

  it("instructs numbered citation format 【N】", () => {
    expect(prompt).toContain("【1】");
    expect(prompt).toContain("【2】");
    expect(prompt).toContain("【3】");
    expect(prompt).not.toContain("[Document Title](URL)");
  });

  it("instructs market-specific answers", () => {
    expect(prompt).toContain("KSA");
    expect(prompt).toContain("UAE");
    expect(prompt).toContain("Egypt");
  });

  it("instructs to match user language", () => {
    expect(prompt).toContain("Chinese");
    expect(prompt).toContain("English");
  });

  it("includes category list", () => {
    expect(prompt).toContain("program_policies");
    expect(prompt).toContain("fulfilled_by_noon_fbn");
  });

  // Scope guard tests
  it("defines scope for Noon seller operations", () => {
    expect(prompt).toContain("politely decline");
  });

  it("instructs to label non-KB advice as general guidance", () => {
    expect(prompt).toContain("非 Noon 官方指引");
  });

  it("reminds that Noon listings require English or Arabic", () => {
    expect(prompt).toMatch(/English.*Arabic|Arabic.*English/);
  });

  // Conciseness tests
  it("instructs to lead with summary", () => {
    expect(prompt).toContain("summary");
  });

  it("instructs multi-market comparison tables by default", () => {
    expect(prompt).toContain("comparison table");
  });

  it("instructs to ask about category before listing all", () => {
    expect(prompt).toContain("ask which product category");
  });
});
