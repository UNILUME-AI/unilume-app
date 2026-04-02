"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import CitationTag from "./CitationTag";
import type { BubbleExtra } from "../_lib/mapMessages";
import type { SourceRef } from "../_lib/types";

/**
 * contentRender callback for assistant (ai) bubbles.
 * Renders markdown with citation support.
 */
export default function AssistantBubbleContent({
  content,
  extra,
}: {
  content: string;
  extra: BubbleExtra;
}) {
  const { sources, isToolCall, firstToolName } = extra;

  const loadingText = (() => {
    switch (firstToolName) {
      case "search_policy": return "正在搜索知识库...";
      case "analyze_market": return "正在分析市场数据...";
      case "compare_markets": return "正在对比市场...";
      case "list_products": return "正在查询商品列表...";
      case "analyze_brands": return "正在分析品牌分布...";
      case "browse_keywords": return "正在查询关键词...";
      default: return "正在查询数据...";
    }
  })();

  const markdownComponents = useMemo(
    () => ({
      a: ({
        href,
        children,
      }: {
        href?: string;
        children?: React.ReactNode;
      }) => (
        <a
          href={href}
          target={href?.startsWith("mailto:") ? undefined : "_blank"}
          rel="noopener noreferrer"
          className="text-brand-500 underline hover:text-brand-600"
        >
          {children}
        </a>
      ),
      "cite-ref": ({
        "data-index": dataIndex,
      }: {
        "data-index"?: string;
      }) => {
        const idx = parseInt(dataIndex || "0");
        const source: SourceRef | undefined = sources.find(
          (s) => s.index === idx,
        );
        return source ? <CitationTag source={source} /> : null;
      },
    }),
    [sources],
  );

  return (
    <div>
      {isToolCall && !content && (
        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#57d4a2] animate-pulse" />
          {loadingText}
        </div>
      )}
      {content && (
        <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-a:text-brand-500 prose-strong:text-gray-900 text-sm text-gray-800">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
