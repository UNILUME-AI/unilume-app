import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../prompts";

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt();

  it("includes article count", () => {
    expect(prompt).toContain("223");
  });

  it("instructs to cite sources with links", () => {
    expect(prompt).toMatch(/\[.*\]\(.*URL.*\)/);
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
});
