"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { Bubble, Sender } from "@ant-design/x";

import { getMessageText } from "../../_lib/helpers";
import { mapMessagesToBubbles } from "../../_lib/mapMessages";
import type { BubbleExtra } from "../../_lib/mapMessages";
import { useChatContext } from "../../_lib/ChatContext";
import { usePersistence } from "../../_lib/usePersistence";
import AssistantBubbleContent from "../../_components/AssistantBubbleContent";
import AssistantBubbleFooter from "../../_components/AssistantBubbleFooter";
import UserBubbleFooter from "../../_components/UserBubbleFooter";
import ToolThoughtChain from "../../_components/ToolThoughtChain";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { isSignedIn, isLoaded } = useUser();
  const {
    refreshConversationList,
    pendingFirstMessage,
    setPendingFirstMessage,
    setShowSignIn,
    getCachedMessages,
    setCachedMessages,
  } = useChatContext();

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const { messages, sendMessage, status, error, setMessages, stop } = useChat({
    transport,
  });

  const [input, setInput] = useState("");
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "up" | "down">>({});

  const isLoading = status === "submitted" || status === "streaming";
  const isLoadingConversationRef = useRef(false);
  const hasSentFirstMessage = useRef(false);

  // ── Message-level persistence ──
  usePersistence({
    conversationId: id,
    messages,
    status,
    isSignedIn: !!isSignedIn,
    isLoadingRef: isLoadingConversationRef,
    onConversationSaved: () => {
      refreshConversationList();
      setCachedMessages(id, messages);
    },
  });

  // ── Load existing conversation or send pending first message ──
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      // If there's a pending first message (came from home page), send it
      if (pendingFirstMessage && !hasSentFirstMessage.current) {
        hasSentFirstMessage.current = true;
        const text = pendingFirstMessage;
        setPendingFirstMessage(null);
        sendMessage({ text });
        return;
      }

      // Otherwise try to load existing conversation
      if (!isSignedIn || hasSentFirstMessage.current) return;

      // 1. Cache-first: show cached messages instantly
      const cached = getCachedMessages(id);
      if (cached && cached.length > 0) {
        isLoadingConversationRef.current = true;
        setMessages(cached as Parameters<typeof setMessages>[0]);
        requestAnimationFrame(() => {
          isLoadingConversationRef.current = false;
        });
      }

      // 2. Stale-while-revalidate: fetch fresh from server
      try {
        const res = await fetch(`/api/conversations?id=${id}`);
        if (!res.ok || cancelled) return;
        const { conversation } = await res.json();
        if (cancelled || !conversation) return;

        const hydrated = conversation.messages.map(
          (m: { id: string; role: string; parts: unknown[] }) => ({
            id: m.id,
            role: m.role,
            parts: m.parts,
          }),
        );

        // Update cache
        setCachedMessages(id, hydrated);

        // Only update UI if data differs from cache
        if (!cached || hydrated.length !== cached.length) {
          isLoadingConversationRef.current = true;
          setMessages(hydrated);
          requestAnimationFrame(() => {
            isLoadingConversationRef.current = false;
          });
        }
      } catch {
        // If fetch fails but we have cache, user still sees content
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isSignedIn]);

  // ── Track last failed message ──
  useEffect(() => {
    if (error && messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) setLastFailedText(getMessageText(lastUserMsg));
    }
  }, [error, messages]);

  const submitFeedback = useCallback(
    async (messageId: string, rating: "up" | "down") => {
      if (feedbackMap[messageId]) return;
      setFeedbackMap((prev) => ({ ...prev, [messageId]: rating }));

      const msgIndex = messages.findIndex((m) => m.id === messageId);
      const userMsg = messages
        .slice(0, msgIndex)
        .reverse()
        .find((m) => m.role === "user");
      const assistantMsg = messages[msgIndex];

      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rating,
            userQuery: userMsg ? getMessageText(userMsg) : "",
            assistantResponse: getMessageText(assistantMsg),
          }),
        });
      } catch {}
    },
    [feedbackMap, messages],
  );

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return;
      if (!isLoaded) return;
      if (!isSignedIn) {
        setShowSignIn(true);
        return;
      }
      setLastFailedText(null);
      sendMessage({ text: text.trim() });
      setInput("");
    },
    [isLoading, isLoaded, isSignedIn, sendMessage, setShowSignIn],
  );

  // ── Edit: resend from a specific message position ──
  const editMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!newText.trim() || isLoading || !isSignedIn) return;

      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex < 0) return;

      const parentId = msgIndex > 0 ? messages[msgIndex - 1].id : null;
      const newMsgId = crypto.randomUUID();

      // Create branch on server
      await fetch(`/api/conversations/${id}/branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentMessageId: parentId,
          message: {
            id: newMsgId,
            role: "user",
            parts: [{ type: "text", text: newText.trim() }],
          },
          branchOrdinal: msgIndex,
        }),
      });

      // Truncate to before the edited message, then let sendMessage add the new one
      isLoadingConversationRef.current = true;
      setMessages(messages.slice(0, msgIndex));
      requestAnimationFrame(() => {
        isLoadingConversationRef.current = false;
        sendMessage({ text: newText.trim() });
      });
    },
    [messages, isLoading, isSignedIn, id, setMessages, sendMessage],
  );

  // ── Regenerate: re-send last user message for a new AI response ──
  const regenerate = useCallback(
    async (assistantMessageId: string) => {
      if (isLoading || !isSignedIn) return;

      const assistantIdx = messages.findIndex((m) => m.id === assistantMessageId);
      if (assistantIdx < 1) return;

      const userMsg = messages[assistantIdx - 1];
      if (userMsg.role !== "user") return;

      const parentOfAssistant = userMsg.id; // the user message is the parent
      const userText = getMessageText(userMsg);

      // Create branch on server (deactivate old assistant response)
      // We don't create a new message here — sendMessage will produce a new one
      await fetch(`/api/conversations/${id}/branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentMessageId: parentOfAssistant,
          message: {
            id: crypto.randomUUID(), // placeholder that will be replaced
            role: "assistant",
            parts: [],
          },
          branchOrdinal: assistantIdx,
        }),
      });

      // Truncate to before the user message, then let sendMessage re-add it + trigger AI
      isLoadingConversationRef.current = true;
      setMessages(messages.slice(0, assistantIdx - 1));
      requestAnimationFrame(() => {
        isLoadingConversationRef.current = false;
        sendMessage({ text: userText });
      });
    },
    [messages, isLoading, isSignedIn, id, setMessages, sendMessage],
  );

  const retry = () => {
    if (lastFailedText) send(lastFailedText);
  };

  const bubbleItems = useMemo(
    () =>
      mapMessagesToBubbles(messages, status, feedbackMap, submitFeedback, {
        onEdit: editMessage,
        onRegenerate: regenerate,
      }),
    [messages, status, feedbackMap, submitFeedback, editMessage, regenerate],
  );

  const roles = useMemo(
    () => ({
      user: {
        placement: "end" as const,
        variant: "filled" as const,
        className: "group",
        styles: {
          content: { borderRadius: 16, fontSize: 14, whiteSpace: "pre-wrap" as const },
        },
        footer: (content: string, info: { extraInfo?: Record<string, unknown> }) => {
          const extra = info.extraInfo as BubbleExtra | undefined;
          if (!extra) return null;
          return <UserBubbleFooter extra={extra} content={content} />;
        },
      },
      ai: {
        placement: "start" as const,
        variant: "outlined" as const,
        styles: { content: { borderRadius: 16, fontSize: 14 } },
        header: (_content: string, info: { extraInfo?: Record<string, unknown> }) => {
          const extra = info.extraInfo as BubbleExtra | undefined;
          if (!extra) return null;
          return <ToolThoughtChain extra={extra} />;
        },
        contentRender: (content: string, info: { extraInfo?: Record<string, unknown> }) => {
          const extra = info.extraInfo as BubbleExtra | undefined;
          if (!extra) return content;
          return <AssistantBubbleContent content={content as string} extra={extra} />;
        },
        footer: (_content: string, info: { extraInfo?: Record<string, unknown> }) => {
          const extra = info.extraInfo as BubbleExtra | undefined;
          if (!extra) return null;
          return <AssistantBubbleFooter extra={extra} />;
        },
      },
    }),
    [],
  );

  return (
    <>
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="mx-auto max-w-[720px] w-full h-full flex flex-col px-4 py-6">
          {messages.length > 0 && (
            <Bubble.List
              items={bubbleItems}
              role={roles}
              autoScroll
              className="flex-1"
              style={{ overflow: "auto" }}
            />
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-[#ffc8c2] bg-[#fff2f0] px-4 py-3 text-sm text-[#c92e34]">
              <div className="flex items-center justify-between">
                <span>请求失败，请稍后重试。</span>
                {lastFailedText && (
                  <button
                    onClick={retry}
                    className="ml-3 rounded-lg bg-[#ffc8c2] px-3 py-1 text-xs font-medium text-[#c92e34] hover:bg-[#ffa099] transition-colors"
                  >
                    重试
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom input bar */}
      <div className="flex-none px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[720px] rounded-2xl border border-[var(--border)] bg-white shadow-[0_2px_12px_rgba(0,0,0,.08)]">
          <Sender
            value={input}
            onChange={(val: string) => setInput(val)}
            onSubmit={(msg: string) => send(msg)}
            loading={isLoading}
            onCancel={stop}
            placeholder="追问或输入新问题..."
            submitType="enter"
            autoSize={{ minRows: 1, maxRows: 4 }}
          />
        </div>
        <p className="mt-2 text-center text-xs text-[var(--ink3)]">
          基于 Noon 官方文档。引用来源标签显示文章最后更新日期，请留意时效性。
        </p>
      </div>
    </>
  );
}
