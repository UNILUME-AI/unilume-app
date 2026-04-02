"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { Bubble, Sender } from "@ant-design/x";
import AppHeader from "@/components/shared/AppHeader";

import { generateId, getMessageText } from "./_lib/helpers";
import { mapMessagesToBubbles } from "./_lib/mapMessages";
import type { BubbleExtra } from "./_lib/mapMessages";
import WelcomePanel from "./_components/WelcomePanel";
import LoginOverlay from "./_components/LoginOverlay";
import AssistantBubbleContent from "./_components/AssistantBubbleContent";
import AssistantBubbleFooter from "./_components/AssistantBubbleFooter";
import ToolThoughtChain from "./_components/ToolThoughtChain";

export default function ChatPage() {
  const { isSignedIn, isLoaded } = useUser();

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const { messages, sendMessage, status, error, setMessages, stop } = useChat({
    transport,
  });

  const [input, setInput] = useState("");
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<
    Record<string, "up" | "down">
  >({});
  const [showSignIn, setShowSignIn] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>(() =>
    generateId(),
  );

  const isLoading = status === "submitted" || status === "streaming";

  // ── Cloud sync: load conversation on mount ──
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/conversations");
        if (!res.ok) return;
        const { conversation } = await res.json();
        if (cancelled || !conversation) return;
        setConversationId(conversation.id);
        setMessages(conversation.messages);
        setShowQuickActions(false);
      } catch {
        // Silently fall back to empty state
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, setMessages]);

  // ── Cloud sync: save conversation when AI finishes responding ──
  useEffect(() => {
    if (status !== "ready" || messages.length === 0 || !isSignedIn) return;
    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: conversationId, messages }),
    }).catch(() => {
      // Silently fail — conversation still works locally
    });
  }, [status, messages, isSignedIn, conversationId]);

  // ── Auto-send pending message after login ──
  useEffect(() => {
    if (isSignedIn && pendingText) {
      sendMessage({ text: pendingText });
      setPendingText(null);
      setShowSignIn(false);
      setShowQuickActions(false);
    }
  }, [isSignedIn, pendingText, sendMessage]);

  // ── Hide quick actions once conversation starts ──
  useEffect(() => {
    if (messages.length > 0) setShowQuickActions(false);
  }, [messages]);

  // ── Track last failed message for retry ──
  useEffect(() => {
    if (error && messages.length > 0) {
      const lastUserMsg = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMsg) {
        setLastFailedText(getMessageText(lastUserMsg));
      }
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
      } catch {
        // Silently fail
      }
    },
    [feedbackMap, messages],
  );

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return;

      if (!isSignedIn) {
        setPendingText(text.trim());
        setShowSignIn(true);
        setInput("");
        return;
      }

      setLastFailedText(null);
      sendMessage({ text: text.trim() });
      setInput("");
    },
    [isLoading, isSignedIn, sendMessage],
  );

  const retry = () => {
    if (lastFailedText) {
      send(lastFailedText);
    }
  };

  // ── Bubble.List items ──
  const bubbleItems = useMemo(
    () => mapMessagesToBubbles(messages, status, feedbackMap, submitFeedback),
    [messages, status, feedbackMap, submitFeedback],
  );

  // ── Role config for Bubble.List ──
  const roles = useMemo(
    () => ({
      user: {
        placement: "end" as const,
        variant: "filled" as const,
        styles: {
          content: {
            borderRadius: 16,
            fontSize: 14,
            whiteSpace: "pre-wrap" as const,
          },
        },
      },
      ai: {
        placement: "start" as const,
        variant: "outlined" as const,
        styles: {
          content: {
            borderRadius: 16,
            fontSize: 14,
          },
        },
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
    <div className="flex flex-col h-dvh bg-gray-50">
      {showSignIn && (
        <LoginOverlay
          onClose={() => {
            setShowSignIn(false);
            setPendingText(null);
          }}
        />
      )}

      <AppHeader
        maxWidth="max-w-3xl"
        actions={
          <>
            <button
              onClick={() => {
                setMessages([]);
                setShowQuickActions(true);
                setLastFailedText(null);
                setConversationId(generateId());
              }}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              新对话
            </button>
            {isLoaded && isSignedIn && <UserButton />}
          </>
        }
      />

      <main className="flex-1 overflow-hidden">
        <div className="mx-auto max-w-3xl h-full flex flex-col px-4 py-6">
          {showQuickActions && messages.length === 0 && (
            <WelcomePanel onSend={send} />
          )}

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

      <div className="flex-none border-t border-gray-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-3xl">
          <Sender
            value={input}
            onChange={(val: string) => setInput(val)}
            onSubmit={(msg: string) => send(msg)}
            loading={isLoading}
            onCancel={stop}
            placeholder="输入你的 Noon 卖家问题..."
            submitType="enter"
            autoSize={{ minRows: 1, maxRows: 4 }}
          />
          <p className="mt-2 text-center text-xs text-gray-400">
            基于 Noon 官方文档。引用来源标签显示文章最后更新日期，请留意时效性。
          </p>
        </div>
      </div>
    </div>
  );
}
