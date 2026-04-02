import { SourceRef, MessagePart, MarketDataLink } from "./types";

const MARKET_TOOLS = new Set([
  "analyze_market",
  "compare_markets",
  "list_products",
  "analyze_brands",
  "browse_keywords",
]);

export function getMessageText(message: { parts?: MessagePart[] }): string {
  if (!message.parts) return "";
  return message.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join("");
}

export function hasToolCall(message: { parts?: MessagePart[] }): boolean {
  return message.parts?.some((p) => p.type.startsWith("tool-")) ?? false;
}

export function getMessageSources(message: { parts?: MessagePart[] }): SourceRef[] {
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

/** Convert 【N】 markers to inline HTML spans for rehype-raw to pick up */
export function injectCitationMarkers(text: string): string {
  return text.replace(
    /【(\d+)】/g,
    '<cite-ref data-index="$1"></cite-ref>'
  );
}

export function getMarketDataLink(message: { parts?: MessagePart[] }): MarketDataLink | null {
  if (!message.parts) return null;
  for (const part of message.parts) {
    if (
      part.type.startsWith("tool-") &&
      part.toolInvocation?.state === "result" &&
      part.toolInvocation.toolName &&
      MARKET_TOOLS.has(part.toolInvocation.toolName)
    ) {
      const { keyword, market } = part.toolInvocation.result ?? {};
      if (keyword) {
        return {
          keyword,
          market: market || "UAE",
          toolName: part.toolInvocation.toolName,
        };
      }
    }
  }
  return null;
}

export function getFirstToolName(message: { parts?: MessagePart[] }): string | null {
  if (!message.parts) return null;
  for (const part of message.parts) {
    if (part.type.startsWith("tool-") && part.toolInvocation?.toolName) {
      return part.toolInvocation.toolName;
    }
  }
  return null;
}

export function generateId(): string {
  return crypto.randomUUID();
}
