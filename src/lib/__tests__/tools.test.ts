import { describe, it, expect, beforeAll } from "vitest";

// Tools tests require GOOGLE_VERTEX_PROJECT for embedding API calls.
// Skip if credentials are not available (CI/local without .env.local).
const hasCredentials = !!process.env.GOOGLE_VERTEX_PROJECT;

describe.skipIf(!hasCredentials)("policyTools (requires credentials)", () => {
  let policyTools: typeof import("../tools").policyTools;

  beforeAll(async () => {
    const mod = await import("../tools");
    policyTools = mod.policyTools;
  });

  it("returns expected result structure including sources", async () => {
    const result = await policyTools.search_policy.execute!(
      { query: "FBN fees", categories: ["fulfilled_by_noon_fbn"] },
      { toolCallId: "test", messages: [], abortSignal: new AbortController().signal }
    );

    expect(result).toHaveProperty("article_count");
    expect(result).toHaveProperty("failed_count");
    expect(result).toHaveProperty("market_filter");
    expect(result).toHaveProperty("articles");
    expect(result).toHaveProperty("sources");
    expect(result).toHaveProperty("instruction");
    expect(Array.isArray(result.sources)).toBe(true);
  });

  it("returns articles with source URLs in context", async () => {
    const result = await policyTools.search_policy.execute!(
      { query: "FBN fees", categories: ["fulfilled_by_noon_fbn"] },
      { toolCallId: "test", messages: [], abortSignal: new AbortController().signal }
    );

    expect(result.articles).toContain("support.noon.partners");
  });

  it("instruction mentions numbered citation format", async () => {
    const result = await policyTools.search_policy.execute!(
      { query: "FBN fees", categories: ["fulfilled_by_noon_fbn"] },
      { toolCallId: "test", messages: [], abortSignal: new AbortController().signal }
    );

    expect(result.instruction).toContain("【1】");
    expect(result.instruction).not.toContain("[Document Title](URL)");
  });

  it("sources have correct structure", async () => {
    const result = await policyTools.search_policy.execute!(
      { query: "FBN fees", categories: ["fulfilled_by_noon_fbn"] },
      { toolCallId: "test", messages: [], abortSignal: new AbortController().signal }
    );

    if (result.sources.length > 0) {
      const source = result.sources[0];
      expect(source).toHaveProperty("index");
      expect(source).toHaveProperty("title");
      expect(source).toHaveProperty("url");
      expect(source.index).toBe(1);
    }
  });
});
