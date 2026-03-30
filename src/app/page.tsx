"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useSession, signIn, signOut } from "next-auth/react";

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

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
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

function injectCitationMarkers(text: string): string {
  return text.replace(
    /【(\d+)】/g,
    '<cite-ref data-index="$1"></cite-ref>'
  );
}

function generateId(): string {
  return crypto.randomUUID();
}

function groupByDate(conversations: ConversationSummary[]): { label: string; items: ConversationSummary[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;

  const groups: Record<string, ConversationSummary[]> = {};
  for (const c of conversations) {
    const t = new Date(c.updatedAt).getTime();
    let label: string;
    if (t >= today) label = "今天";
    else if (t >= yesterday) label = "昨天";
    else if (t >= weekAgo) label = "最近 7 天";
    else label = "更早";
    (groups[label] ??= []).push(c);
  }

  const order = ["今天", "昨天", "最近 7 天", "更早"];
  return order.filter((l) => groups[l]).map((l) => ({ label: l, items: groups[l] }));
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
            <span className="text-[11px] text-blue-600">点击查看原文 →</span>
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

// ── Sidebar Component ──────────────────────────────────

function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  session,
  sidebarOpen,
  onClose,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  session: { user?: { name?: string | null; image?: string | null } } | null;
  sidebarOpen: boolean;
  onClose: () => void;
}) {
  const groups = groupByDate(conversations);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 sm:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed sm:relative z-50 sm:z-auto top-0 left-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col transition-transform sm:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        }`}
      >
        {/* New chat button */}
        <div className="flex-none p-3 border-b border-gray-100">
          <button
            onClick={() => { onNew(); onClose(); }}
            className="w-full flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            新对话
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-4">暂无对话记录</p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="text-[11px] text-gray-400 font-medium px-2 mb-1">{group.label}</p>
                {group.items.map((c) => (
                  <div
                    key={c.id}
                    className={`group flex items-center rounded-lg px-2 py-1.5 text-sm cursor-pointer transition-colors ${
                      c.id === activeId
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                    onClick={() => { onSelect(c.id); onClose(); }}
                  >
                    <span className="flex-1 truncate">{c.title || "新对话"}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                      className="flex-none opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                      title="删除"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                        <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* User section */}
        <div className="flex-none p-3 border-t border-gray-100">
          {session?.user ? (
            <div className="flex items-center gap-2">
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt=""
                  className="h-7 w-7 rounded-full"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="flex-1 text-xs text-gray-600 truncate">{session.user.name}</span>
              <button
                onClick={() => signOut()}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                退出
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google 登录
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Main Component ─────────────────────────────────────

export default function ChatPage() {
  const { data: session, status: authStatus } = useSession();
  const isLoggedIn = !!session?.user;

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Conversation state
  const [conversationId, setConversationId] = useState<string>(() => generateId());
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const isLoading = status === "submitted" || status === "streaming";

  // Fetch conversation list on login
  useEffect(() => {
    if (!isLoggedIn) {
      setConversations([]);
      return;
    }
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setConversations(data);
      })
      .catch(() => {});
  }, [isLoggedIn]);

  // Save conversation to server when response completes
  useEffect(() => {
    if (status !== "ready" || messages.length === 0 || !isLoggedIn) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const firstUserMsg = messages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? getMessageText(firstUserMsg).slice(0, 30)
        : "新对话";

      fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: conversationId, title, messages }),
      })
        .then(() =>
          fetch("/api/conversations")
            .then((r) => r.json())
            .then((data) => {
              if (Array.isArray(data)) setConversations(data);
            })
        )
        .catch(() => {});
    }, 500);
  }, [status, messages, isLoggedIn, conversationId]);

  // Load a conversation
  const loadConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/conversations/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setConversationId(id);
        setMessages(data.messages || []);
        setShowQuickActions(false);
        setFeedbackMap({});
      } catch {
        // ignore
      }
    },
    [setMessages]
  );

  // Start new conversation
  const startNewConversation = useCallback(() => {
    setConversationId(generateId());
    setMessages([]);
    setShowQuickActions(true);
    setLastFailedText(null);
    setFeedbackMap({});
  }, [setMessages]);

  // Delete conversation
  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/conversations/${id}`, { method: "DELETE" });
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (id === conversationId) startNewConversation();
      } catch {
        // ignore
      }
    },
    [conversationId, startNewConversation]
  );

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
      setLastFailedText(null);
      sendMessage({ text: text.trim() });
      setInput("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
    },
    [isLoading, sendMessage]
  );

  const retry = () => {
    if (lastFailedText) send(lastFailedText);
  };

  useEffect(() => {
    if (error && messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) setLastFailedText(getMessageText(lastUserMsg));
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

  if (authStatus === "loading") {
    return (
      <div className="flex items-center justify-center h-dvh bg-gray-50">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh bg-gray-50">
      {/* Sidebar — only show when logged in */}
      {isLoggedIn && (
        <Sidebar
          conversations={conversations}
          activeId={conversationId}
          onSelect={loadConversation}
          onNew={startNewConversation}
          onDelete={deleteConversation}
          session={session}
          sidebarOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex-none border-b border-gray-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div className="flex items-center gap-2">
              {isLoggedIn && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="sm:hidden p-1 text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 012 10z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
              <span className="text-lg font-semibold tracking-tight text-gray-900">
                UNILUME
              </span>
              <span className="hidden sm:inline text-xs text-gray-400 border-l border-gray-200 pl-2 ml-1">
                Noon 卖家运营助手
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isLoggedIn ? (
                <button
                  onClick={startNewConversation}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  新对话
                </button>
              ) : (
                <button
                  onClick={() => signIn("google")}
                  className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                  登录
                </button>
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
    </div>
  );
}
