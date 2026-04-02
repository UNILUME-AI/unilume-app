import { SourceRef, MessagePart } from "./types";

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

export function generateId(): string {
  return crypto.randomUUID();
}
