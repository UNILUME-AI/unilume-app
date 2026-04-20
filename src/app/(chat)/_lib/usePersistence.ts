"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "./types";

const STREAM_PERSIST_INTERVAL = 2500; // ms

interface UsePersistenceOptions {
  conversationId: string;
  messages: ChatMessage[];
  status: string;
  isSignedIn: boolean;
  /** Set to true while programmatically loading messages (skip persistence). */
  isLoadingRef: React.RefObject<boolean>;
  onConversationSaved?: () => void;
}

/** Extract first N chars of first user message text as conversation title. */
function extractTitle(msg: ChatMessage, maxLen = 50): string {
  const text =
    msg.parts
      ?.filter((p) => p.type === "text" && p.text)
      .map((p) => p.text)
      .join("") ?? "";
  return text.slice(0, maxLen) || "新对话";
}

/**
 * Write-behind persistence hook.
 *
 * Detects new messages by diffing against a ref of previously-persisted IDs.
 * Streams are persisted incrementally and finalized on completion.
 */
export function usePersistence({
  conversationId,
  messages,
  status,
  isSignedIn,
  isLoadingRef,
  onConversationSaved,
}: UsePersistenceOptions) {
  const persistedIdsRef = useRef<Set<string>>(new Set());
  const streamingMsgIdRef = useRef<string | null>(null);
  const lastPartsJsonRef = useRef<string>("");
  const convIdRef = useRef(conversationId);

  // Reset refs when conversation changes
  useEffect(() => {
    if (convIdRef.current !== conversationId) {
      persistedIdsRef.current = new Set();
      streamingMsgIdRef.current = null;
      lastPartsJsonRef.current = "";
      convIdRef.current = conversationId;
    }
  }, [conversationId]);

  // Hydrate persisted IDs when loading an existing conversation
  useEffect(() => {
    if (isLoadingRef.current && messages.length > 0) {
      persistedIdsRef.current = new Set(messages.map((m) => m.id));
    }
  }, [messages, isLoadingRef]);

  const apiBase = `/api/conversations/${conversationId}/messages`;

  // ── Detect new messages and persist them ──
  useEffect(() => {
    if (!isSignedIn || isLoadingRef.current) return;

    const newMessages = messages.filter(
      (m) => !persistedIdsRef.current.has(m.id),
    );
    if (newMessages.length === 0) return;

    for (let i = 0; i < newMessages.length; i++) {
      const msg = newMessages[i];
      const msgIndex = messages.findIndex((m) => m.id === msg.id);
      const parentId = msgIndex > 0 ? messages[msgIndex - 1].id : null;
      const isAssistant = msg.role === "assistant";
      const isStreaming =
        isAssistant &&
        (status === "submitted" || status === "streaming") &&
        msgIndex === messages.length - 1;

      // Build title from first user message
      const isFirstUser = msg.role === "user" && msgIndex === 0;

      persistedIdsRef.current.add(msg.id);

      if (isStreaming) {
        streamingMsgIdRef.current = msg.id;
      }

      fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: msg.id,
          parentMessageId: parentId,
          role: msg.role,
          parts: msg.parts ?? [],
          status: isStreaming ? "streaming" : "complete",
          ordinal: msgIndex,
          ...(isFirstUser ? { title: extractTitle(msg) } : {}),
        }),
      })
        .then(() => {
          if (isFirstUser) onConversationSaved?.();
        })
        .catch(() => {
          // Remove from persisted set so retry is possible
          persistedIdsRef.current.delete(msg.id);
        });
    }
  }, [messages, status, isSignedIn, isLoadingRef, apiBase, onConversationSaved]);

  // ── Streaming persistence: periodically PATCH parts ──
  useEffect(() => {
    if (
      status !== "streaming" ||
      !streamingMsgIdRef.current ||
      !isSignedIn
    )
      return;

    const timer = setInterval(() => {
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg || lastMsg.id !== streamingMsgIdRef.current) return;

      const partsJson = JSON.stringify(lastMsg.parts ?? []);
      if (partsJson === lastPartsJsonRef.current) return;
      lastPartsJsonRef.current = partsJson;

      fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: streamingMsgIdRef.current,
          parts: lastMsg.parts ?? [],
        }),
      }).catch(() => {});
    }, STREAM_PERSIST_INTERVAL);

    return () => clearInterval(timer);
  }, [status, messages, isSignedIn, apiBase]);

  // ── Finalize when streaming completes ──
  useEffect(() => {
    if (status !== "ready" || !streamingMsgIdRef.current || !isSignedIn) return;

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;

    const msgId = streamingMsgIdRef.current;
    streamingMsgIdRef.current = null;
    lastPartsJsonRef.current = "";

    fetch(apiBase, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId: msgId,
        parts: lastMsg.parts ?? [],
      }),
    })
      .then(() => onConversationSaved?.())
      .catch(() => {});
  }, [status, messages, isSignedIn, apiBase, onConversationSaved]);
}
