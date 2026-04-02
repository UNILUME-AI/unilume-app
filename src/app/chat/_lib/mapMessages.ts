import type { BubbleItemType } from "@ant-design/x";
import type { ChatMessage } from "./types";
import { getMessageText, getMessageSources, hasToolCall, injectCitationMarkers } from "./helpers";

export interface BubbleExtra {
  messageId: string;
  sources: ReturnType<typeof getMessageSources>;
  feedbackState: "up" | "down" | undefined;
  onFeedback: (messageId: string, rating: "up" | "down") => void;
  isToolCall: boolean;
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

  for (const msg of messages) {
    const text = getMessageText(msg);
    const sources = getMessageSources(msg);
    const processedText = sources.length > 0 ? injectCitationMarkers(text) : text;

    const extra: BubbleExtra = {
      messageId: msg.id,
      sources,
      feedbackState: feedbackMap[msg.id],
      onFeedback,
      isToolCall: hasToolCall(msg),
    };

    if (msg.role === "user") {
      items.push({
        key: msg.id,
        role: "user",
        content: text,
        extraInfo: extra,
      });
    } else {
      // For assistant messages, only show if there is text content
      // (tool-call-only messages with no text will show loading via the loading bubble below)
      if (text) {
        items.push({
          key: msg.id,
          role: "ai",
          content: processedText,
          extraInfo: extra,
        });
      }
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
