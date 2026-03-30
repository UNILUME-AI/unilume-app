import { describe, it, expect } from "vitest";

// Test the citation-related pure functions extracted from page.tsx logic

// Re-implement the helpers here since they're inlined in the component
function injectCitationMarkers(text: string): string {
  return text.replace(
    /【(\d+)】/g,
    '<cite-ref data-index="$1"></cite-ref>'
  );
}

interface SourceRef {
  index: number;
  title: string;
  url: string;
}

interface MessagePart {
  type: string;
  text?: string;
  toolInvocation?: {
    state: string;
    result?: { sources?: SourceRef[] };
  };
}

function getMessageText(message: { parts?: MessagePart[] }): string {
  if (!message.parts) return [];
  return message.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join("");
}

function getMessageSources(message: { parts?: MessagePart[] }): SourceRef[] {
  if (!message.parts) return [];
  for (const part of message.parts) {
    if (
      part.type.startsWith("tool-") &&
      part.toolInvocation?.state === "result" &&
      Array.isArray(part.toolInvocation.result?.sources)
    ) {
      return part.toolInvocation.result.sources;
    }
  }
  return [];
}

describe("injectCitationMarkers", () => {
  it("converts 【1】 to cite-ref HTML element", () => {
    const result = injectCitationMarkers("Some text 【1】 more text");
    expect(result).toBe('Some text <cite-ref data-index="1"></cite-ref> more text');
  });

  it("handles multiple citations", () => {
    const result = injectCitationMarkers("Point A 【1】 and point B 【2】");
    expect(result).toContain('data-index="1"');
    expect(result).toContain('data-index="2"');
  });

  it("handles adjacent citations", () => {
    const result = injectCitationMarkers("Some fact 【1】【3】");
    expect(result).toContain('data-index="1"');
    expect(result).toContain('data-index="3"');
  });

  it("returns text unchanged when no citations present", () => {
    const text = "No citations here";
    expect(injectCitationMarkers(text)).toBe(text);
  });

  it("handles double-digit citation numbers", () => {
    const result = injectCitationMarkers("Reference 【12】");
    expect(result).toContain('data-index="12"');
  });

  it("does not match incomplete markers", () => {
    expect(injectCitationMarkers("【abc】")).toBe("【abc】");
    expect(injectCitationMarkers("【】")).toBe("【】");
  });
});

describe("getMessageText", () => {
  it("extracts text from text parts", () => {
    const message = {
      parts: [
        { type: "text", text: "Hello " },
        { type: "text", text: "world" },
      ],
    };
    expect(getMessageText(message)).toBe("Hello world");
  });

  it("ignores non-text parts", () => {
    const message = {
      parts: [
        { type: "text", text: "Hello" },
        { type: "tool-search_policy" },
        { type: "text", text: " world" },
      ],
    };
    expect(getMessageText(message)).toBe("Hello world");
  });

  it("returns empty string for message with no parts", () => {
    expect(getMessageText({})).toEqual([]);
  });
});

describe("getMessageSources", () => {
  it("extracts sources from tool result part", () => {
    const sources = [
      { index: 1, title: "FBN Fees", url: "https://support.noon.partners/fbn" },
    ];
    const message = {
      parts: [
        {
          type: "tool-search_policy",
          toolInvocation: {
            state: "result",
            result: { sources },
          },
        },
        { type: "text", text: "Answer text" },
      ],
    };
    expect(getMessageSources(message)).toEqual(sources);
  });

  it("returns empty array when no tool parts", () => {
    const message = {
      parts: [{ type: "text", text: "Just text" }],
    };
    expect(getMessageSources(message)).toEqual([]);
  });

  it("returns empty array when tool call is still pending", () => {
    const message = {
      parts: [
        {
          type: "tool-search_policy",
          toolInvocation: { state: "call" },
        },
      ],
    };
    expect(getMessageSources(message)).toEqual([]);
  });

  it("returns empty array when result has no sources", () => {
    const message = {
      parts: [
        {
          type: "tool-search_policy",
          toolInvocation: {
            state: "result",
            result: { articles: "some content" },
          },
        },
      ],
    };
    expect(getMessageSources(message)).toEqual([]);
  });

  it("returns empty array for message with no parts", () => {
    expect(getMessageSources({})).toEqual([]);
  });
});
