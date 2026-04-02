"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import CitationTag from "./CitationTag";
import type { SourceRef, ChatMessage } from "../_lib/types";
import {
  getMessageText,
  hasToolCall,
  getMessageSources,
  injectCitationMarkers,
} from "../_lib/helpers";

interface MessageBubbleProps {
  message: ChatMessage;
  feedbackState: "up" | "down" | undefined;
  onFeedback: (messageId: string, rating: "up" | "down") => void;
}

export default function MessageBubble({
  message,
  feedbackState,
  onFeedback,
}: MessageBubbleProps) {
  const text = getMessageText(message);
  const sources = getMessageSources(message);
  const processedText = sources.length > 0 ? injectCitationMarkers(text) : text;

  const markdownComponents = useMemo(
    () => ({
      a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
        <a
          href={href}
          target={href?.startsWith("mailto:") ? undefined : "_blank"}
          rel="noopener noreferrer"
          className="text-brand-500 underline hover:text-brand-600"
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
    [sources]
  );

  if (message.role === "user") {
    return (
      <div className="mb-4 sm:mb-6 flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-brand-500 px-4 py-3 text-white text-sm whitespace-pre-wrap">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 sm:mb-6">
      <div className="max-w-[85%]">
        {hasToolCall(message) && (
          <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#57d4a2] animate-pulse" />
            正在搜索知识库...
          </div>
        )}
        {text && (
          <>
            <div className="rounded-2xl bg-white border border-gray-200 px-5 py-4 text-sm text-gray-800 shadow-sm prose prose-sm max-w-none prose-headings:text-gray-900 prose-a:text-brand-500 prose-strong:text-gray-900">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={markdownComponents}
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
                onClick={() => onFeedback(message.id, "up")}
                disabled={!!feedbackState}
                className={`rounded-lg p-1.5 transition-colors ${feedbackState === "up" ? "text-brand-500" : "text-gray-300 hover:text-gray-500"} disabled:cursor-default`}
                title="有帮助"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M1 8.998a1 1 0 0 1 1-1h3v9H2a1 1 0 0 1-1-1v-7Zm5.5 8.25 1.816-4.538A1 1 0 0 0 7.382 11H13.5a1 1 0 0 0 .979-.803l1.333-6.222A1.5 1.5 0 0 0 14.348 2.5H9.5v4.25a.75.75 0 0 1-1.5 0V2.5H6.5v14.748Z" />
                </svg>
              </button>
              <button
                onClick={() => onFeedback(message.id, "down")}
                disabled={!!feedbackState}
                className={`rounded-lg p-1.5 transition-colors ${feedbackState === "down" ? "text-[#c92e34]" : "text-gray-300 hover:text-gray-500"} disabled:cursor-default`}
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
    </div>
  );
}
