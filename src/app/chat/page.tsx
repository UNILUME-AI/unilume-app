"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import AppHeader from "@/components/shared/AppHeader";

import { generateId, getMessageText } from "./_lib/helpers";
import WelcomePanel from "./_components/WelcomePanel";
import LoginOverlay from "./_components/LoginOverlay";
import MessageBubble from "./_components/MessageBubble";
import ChatInput from "./_components/ChatInput";

export default function ChatPage() {
  const { isSignedIn, isLoaded } = useUser();

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "up" | "down">>({});
  const [showSignIn, setShowSignIn] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>(() => generateId());

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
    return () => { cancelled = true; };
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

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Hide quick actions once conversation starts ──
  useEffect(() => {
    if (messages.length > 0) setShowQuickActions(false);
  }, [messages]);

  // ── Track last failed message for retry ──
  useEffect(() => {
    if (error && messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        setLastFailedText(getMessageText(lastUserMsg));
      }
    }
  }, [error, messages]);

  const submitFeedback = async (messageId: string, rating: "up" | "down") => {
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
  };

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
    [isLoading, isSignedIn, sendMessage]
  );

  const retry = () => {
    if (lastFailedText) {
      send(lastFailedText);
    }
  };

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

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {showQuickActions && messages.length === 0 && (
            <WelcomePanel onSend={send} />
          )}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              feedbackState={feedbackMap[message.id]}
              onFeedback={submitFeedback}
            />
          ))}

          {isLoading &&
            messages.length > 0 &&
            messages[messages.length - 1]?.role === "user" && (
              <div className="mb-6">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
                  思考中...
                </div>
              </div>
            )}

          {error && (
            <div className="mb-6 rounded-xl border border-[#ffc8c2] bg-[#fff2f0] px-4 py-3 text-sm text-[#c92e34]">
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

          <div ref={messagesEndRef} />
        </div>
      </main>

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={send}
        isLoading={isLoading}
      />
    </div>
  );
}
