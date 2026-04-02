import type { BubbleItemType } from "@ant-design/x";
import type { ChatMessage, ToolPart, ReasoningPart } from "./types";
import { getMessageText, getMessageSources, hasToolCall, injectCitationMarkers } from "./helpers";

export interface BubbleExtra {
  messageId: string;
  sources: ReturnType<typeof getMessageSources>;
  feedbackState: "up" | "down" | undefined;
  onFeedback: (messageId: string, rating: "up" | "down") => void;
  isToolCall: boolean;
  toolParts: ToolPart[];
  reasoningParts: ReasoningPart[];
  isStreaming: boolean;
}

export function extractToolParts(msg: ChatMessage): ToolPart[] {
  if (!msg.parts) return [];
  return msg.parts
    .filter((p) => p.type.startsWith("tool-") && p.toolInvocation)
    .map((p) => ({
      toolName: p.toolInvocation!.toolName ?? p.type,
      state: p.toolInvocation!.state as ToolPart["state"],
    }));
}

export function extractReasoningParts(msg: ChatMessage): ReasoningPart[] {
  if (!msg.parts) return [];
  return msg.parts
    .filter((p) => p.type === "reasoning" && p.text)
    .map((p) => ({ text: p.text! }));
}

/**
 * Convert AI-SDK messages into Bubble.List items.
 * Each item carries `extraInfo` so contentRender / footer can access metadata.
 */
export function mapMessagesToBubbles(
  messages: ChatMessage[],
  status: string,
  feedbackMap: Record<string, "up" | "down">,
  onFeedback: (messageId: string, rating: "up" | "down") => void,
): BubbleItemType[] {
  const items: BubbleItemType[] = [];
  const isActive = status === "submitted" || status === "streaming";

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const text = getMessageText(msg);
    const sources = getMessageSources(msg);
    const processedText = sources.length > 0 ? injectCitationMarkers(text) : text;
    const isLastAssistant = isActive && msg.role === "assistant" && i === messages.length - 1;

    const extra: BubbleExtra = {
      messageId: msg.id,
      sources,
      feedbackState: feedbackMap[msg.id],
      onFeedback,
      isToolCall: hasToolCall(msg),
      toolParts: extractToolParts(msg),
      reasoningParts: extractReasoningParts(msg),
      isStreaming: isLastAssistant,
    };

    if (msg.role === "user") {
      items.push({
        key: msg.id,
        role: "user",
        content: text,
        extraInfo: extra,
      });
    } else {
      items.push({
        key: msg.id,
        role: "ai",
        content: processedText,
        extraInfo: extra,
      });
    }
  }

  // Add loading indicator when waiting for assistant response
  const isLoading = status === "submitted" || status === "streaming";
  if (
    isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "user"
  ) {
    items.push({
      key: "__loading__",
      role: "ai",
      content: "",
      loading: true,
    });
  }

  return items;
}
