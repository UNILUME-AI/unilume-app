"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useUser, SignIn, UserButton } from "@clerk/nextjs";

import { QUICK_ACTIONS } from "@/config/quick-actions";

// ── Types ──────────────────────────────────────────────

interface SourceRef {
  index: number;
  title: string;
  url: string;
  modifiedTime?: string;
}

interface MessagePart {
  type: string;
  text?: string;
  toolInvocation?: {
    state: string;
    result?: { sources?: SourceRef[] };
  };
}

// ── Helpers ────────────────────────────────────────────

function getMessageText(message: { parts?: MessagePart[] }): string {
  if (!message.parts) return "";
  return message.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join("");
}

function hasToolCall(message: { parts?: MessagePart[] }): boolean {
  return message.parts?.some((p) => p.type.startsWith("tool-")) ?? false;
}

function getMessageSources(message: { parts?: MessagePart[] }): SourceRef[] {
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
function injectCitationMarkers(text: string): string {
  return text.replace(
    /【(\d+)】/g,
    '<cite-ref data-index="$1"></cite-ref>'
  );
}

function generateId(): string {
  return crypto.randomUUID();
}

// ── Citation Tag Component ─────────────────────────────

function CitationTag({ source }: { source: SourceRef }) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShow(true);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setShow(false), 200);
  };

  const label = source.title.length > 20
    ? source.title.slice(0, 18) + "…"
    : source.title;

  return (
    <span
      className="relative inline-flex items-center align-baseline mx-0.5"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-500 no-underline hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer leading-tight"
      >
        <span className="font-medium text-gray-400">{source.index}</span>
        <span className="hidden sm:inline truncate max-w-[120px]">{label}</span>
      </a>

      {show && (
        <div
          className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg z-50"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path d="M1 4.75C1 3.784 1.784 3 2.75 3h10.5c.966 0 1.75.784 1.75 1.75v6.5A1.75 1.75 0 0 1 13.25 13H2.75A1.75 1.75 0 0 1 1 11.25v-6.5Zm12 0a.25.25 0 0 0-.25-.25H2.75a.25.25 0 0 0-.25.25v6.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-6.5Z" />
            </svg>
            support.noon.partners
          </div>
          <p className="text-sm font-medium text-gray-900 leading-snug mb-1">
            {source.title}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-blue-600">
              点击查看原文 →
            </span>
            {source.modifiedTime && (
              <span className="text-[10px] text-gray-400">
                更新于 {source.modifiedTime.slice(0, 10)}
              </span>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────

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
  const inputRef = useRef<HTMLTextAreaElement>(null);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) setShowQuickActions(false);
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return;

      // Auth gate: if not signed in, store text and show login overlay
      if (!isSignedIn) {
        setPendingText(text.trim());
        setShowSignIn(true);
        setInput("");
        return;
      }

      setLastFailedText(null);
      sendMessage({ text: text.trim() });
      setInput("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
    },
    [isLoading, isSignedIn, sendMessage]
  );

  const retry = () => {
    if (lastFailedText) {
      send(lastFailedText);
    }
  };

  useEffect(() => {
    if (error && messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        setLastFailedText(getMessageText(lastUserMsg));
      }
    }
  }, [error, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const buildMarkdownComponents = useCallback(
    (sources: SourceRef[]) => ({
      a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
        <a
          href={href}
          target={href?.startsWith("mailto:") ? undefined : "_blank"}
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800"
        >
          {children}
        </a>
      ),
      "cite-ref": ({ "data-index": dataIndex }: { "data-index"?: string }) => {
        const idx = parseInt(dataIndex || "0");
        const source = sources.find((s) => s.index === idx);
        return source ? <CitationTag source={source} /> : null;
      },
    }),
    []
  );

  return (
    <div className="flex flex-col h-dvh bg-gray-50">
      {/* Login Overlay */}
      {showSignIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative">
            <button
              onClick={() => {
                setShowSignIn(false);
                setPendingText(null);
              }}
              className="absolute -top-3 -right-3 z-10 rounded-full bg-white p-1.5 shadow-md hover:bg-gray-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-500">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
            <SignIn
              fallbackRedirectUrl="/"
              appearance={{
                elements: {
                  card: "shadow-2xl",
                },
              }}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex-none border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight text-gray-900">
              UNILUME
            </span>
            <span className="hidden sm:inline text-xs text-gray-400 border-l border-gray-200 pl-2 ml-1">
              Noon 卖家运营助手
            </span>
          </div>
          <div className="flex items-center gap-3">
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
            {isLoaded && isSignedIn && (
              <UserButton afterSignOutUrl="/" />
            )}
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {/* Welcome State */}
          {showQuickActions && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[40vh] sm:min-h-[60vh]">
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                UNILUME
              </h1>
              <p className="text-sm text-gray-500 mb-1">
                助力你的电商决策
              </p>
              <p className="text-sm text-gray-400 mb-8 text-center max-w-md">
                关于 Noon 卖家政策、费用和流程的任何问题，都可以问我。
                基于 223+ 篇官方帮助文档。
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {QUICK_ACTIONS.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => send(action.text)}
                    className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 shadow-sm hover:border-gray-300 hover:shadow-md transition-all"
                  >
                    <span className="text-base flex-none mt-0.5">
                      {action.icon}
                    </span>
                    <span>{action.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => {
            const text = getMessageText(message);
            const sources = getMessageSources(message);
            const processedText = sources.length > 0
              ? injectCitationMarkers(text)
              : text;

            return (
              <div
                key={message.id}
                className={`mb-4 sm:mb-6 ${message.role === "user" ? "flex justify-end" : ""}`}
              >
                {message.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl bg-blue-600 px-4 py-3 text-white text-sm whitespace-pre-wrap">
                    {text}
                  </div>
                ) : (
                  <div className="max-w-[85%]">
                    {hasToolCall(message) && (
                      <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                        正在搜索知识库...
                      </div>
                    )}
                    {text && (
                      <>
                        <div className="rounded-2xl bg-white border border-gray-200 px-5 py-4 text-sm text-gray-800 shadow-sm prose prose-sm max-w-none prose-headings:text-gray-900 prose-a:text-blue-600 prose-strong:text-gray-900">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={buildMarkdownComponents(sources)}
                          >
                            {processedText}
                          </ReactMarkdown>
                        </div>

                        {sources.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1">
                            <span className="text-[11px] text-gray-400">
                              {sources.length} 个来源
                            </span>
                            {sources.map((s) => (
                              <a
                                key={s.index}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-500 no-underline hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                title={s.title}
                              >
                                <span className="font-medium text-gray-400">{s.index}</span>
                                <span className="truncate max-w-[100px]">{s.title}</span>
                              </a>
                            ))}
                          </div>
                        )}

                        <div className="mt-1.5 flex items-center gap-1 pl-1">
                          <button
                            onClick={() => submitFeedback(message.id, "up")}
                            disabled={!!feedbackMap[message.id]}
                            className={`rounded-lg p-1.5 transition-colors ${feedbackMap[message.id] === "up" ? "text-blue-600" : "text-gray-300 hover:text-gray-500"} disabled:cursor-default`}
                            title="有帮助"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                              <path d="M1 8.998a1 1 0 0 1 1-1h3v9H2a1 1 0 0 1-1-1v-7Zm5.5 8.25 1.816-4.538A1 1 0 0 0 7.382 11H13.5a1 1 0 0 0 .979-.803l1.333-6.222A1.5 1.5 0 0 0 14.348 2.5H9.5v4.25a.75.75 0 0 1-1.5 0V2.5H6.5v14.748Z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => submitFeedback(message.id, "down")}
                            disabled={!!feedbackMap[message.id]}
                            className={`rounded-lg p-1.5 transition-colors ${feedbackMap[message.id] === "down" ? "text-red-500" : "text-gray-300 hover:text-gray-500"} disabled:cursor-default`}
                            title="没帮助"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 rotate-180">
                              <path d="M1 8.998a1 1 0 0 1 1-1h3v9H2a1 1 0 0 1-1-1v-7Zm5.5 8.25 1.816-4.538A1 1 0 0 0 7.382 11H13.5a1 1 0 0 0 .979-.803l1.333-6.222A1.5 1.5 0 0 0 14.348 2.5H9.5v4.25a.75.75 0 0 1-1.5 0V2.5H6.5v14.748Z" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading &&
            messages.length > 0 &&
            messages[messages.length - 1]?.role === "user" && (
              <div className="mb-6">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  思考中...
                </div>
              </div>
            )}

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-center justify-between">
                <span>请求失败，请稍后重试。</span>
                {lastFailedText && (
                  <button
                    onClick={retry}
                    className="ml-3 rounded-lg bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 transition-colors"
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

      {/* Input Area */}
      <div className="flex-none border-t border-gray-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的 Noon 卖家问题..."
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            style={{ maxHeight: "120px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height =
                Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={isLoading || !input.trim()}
            className="flex-none rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
            </svg>
          </button>
        </div>
        <p className="mx-auto max-w-3xl mt-2 text-center text-xs text-gray-400">
          基于 Noon 官方文档。引用来源标签显示文章最后更新日期，请留意时效性。
        </p>
      </div>
    </div>
  );
}
