export interface SourceRef {
  index: number;
  title: string;
  url: string;
  modifiedTime?: string;
}

export interface MessagePart {
  type: string;
  text?: string;
  toolInvocation?: {
    toolName?: string;
    state: string;
    result?: { sources?: SourceRef[] };
  };
}

export interface ToolPart {
  toolName: string;
  state: "call" | "result" | "partial-call";
}

export interface ReasoningPart {
  text: string;
}

/** Subset of AI SDK's UIMessage used by chat components */
export interface ChatMessage {
  id: string;
  role: string;
  parts?: MessagePart[];
}

export interface ConversationListItem {
  id: string;
  label: string;
  updated_at: string;
}
