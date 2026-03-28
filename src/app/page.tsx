"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const QUICK_ACTIONS = [
  { icon: "📋", text: "Noon 退货政策是什么？" },
  { icon: "💰", text: "FBN 物流费怎么算？" },
  { icon: "🏪", text: "如何在 Noon 开店？" },
  { icon: "📦", text: "DirectShip 和 FBN 有什么区别？" },
  { icon: "⚠️", text: "卖家违规会有什么处罚？" },
  { icon: "🌍", text: "如何做跨境电商？" },
];

function getMessageText(message: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!message.parts) return "";
  return message.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join("");
}

function hasToolCall(message: { parts?: Array<{ type: string }> }): boolean {
  return message.parts?.some((p) => p.type.startsWith("tool-")) ?? false;
}

const STORAGE_KEY = "unilume-chat-history";

function loadHistory() {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export default function ChatPage() {
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
  const [showQuickActions, setShowQuickActions] = useState(
    () => loadHistory().length === 0
  );
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);

  const isLoading = status === "submitted" || status === "streaming";

  // Save messages to localStorage when a response completes
  useEffect(() => {
    if (status === "ready" && messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch {
        // localStorage full or unavailable
      }
    }
  }, [status, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) setShowQuickActions(false);
  }, [messages]);

  // Restore chat history from localStorage on mount
  useEffect(() => {
    const saved = loadHistory();
    if (saved.length > 0) {
      setMessages(saved);
      setShowQuickActions(false);
    }
  }, [setMessages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = (text: string) => {
    if (!text.trim() || isLoading) return;
    setLastFailedText(null);
    sendMessage({ text: text.trim() });
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="flex-none border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight text-gray-900">
              UNILUME
            </span>
            <span className="hidden sm:inline text-xs text-gray-400 border-l border-gray-200 pl-2 ml-1">
              Noon Policy Agent
            </span>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              setMessages([]);
              setShowQuickActions(true);
              setLastFailedText(null);
            }}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            New Chat
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {/* Welcome State */}
          {showQuickActions && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                UNILUME
              </h1>
              <p className="text-sm text-gray-500 mb-1">
                Illuminate Your E-commerce Decisions
              </p>
              <p className="text-sm text-gray-400 mb-8 text-center max-w-md">
                Ask anything about Noon seller policies, fees, and procedures.
                Powered by 223+ official help articles.
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
            return (
              <div
                key={message.id}
                className={`mb-6 ${message.role === "user" ? "flex justify-end" : ""}`}
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
                        Searching knowledge base...
                      </div>
                    )}
                    {text && (
                      <div className="rounded-2xl bg-white border border-gray-200 px-5 py-4 text-sm text-gray-800 shadow-sm prose prose-sm max-w-none prose-headings:text-gray-900 prose-a:text-blue-600 prose-strong:text-gray-900">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {text}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading indicator */}
          {isLoading &&
            messages.length > 0 &&
            messages[messages.length - 1]?.role === "user" && (
              <div className="mb-6">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Thinking...
                </div>
              </div>
            )}

          {/* Error state */}
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
      <div className="flex-none border-t border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Noon policies..."
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
          Powered by Noon official documentation. Answers may not reflect
          the latest policy changes.
        </p>
      </div>
    </div>
  );
}
