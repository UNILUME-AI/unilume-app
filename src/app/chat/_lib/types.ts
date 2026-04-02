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
    state: string;
    result?: { sources?: SourceRef[] };
  };
}

/** Subset of AI SDK's UIMessage used by chat components */
export interface ChatMessage {
  id: string;
  role: string;
  parts?: MessagePart[];
}
