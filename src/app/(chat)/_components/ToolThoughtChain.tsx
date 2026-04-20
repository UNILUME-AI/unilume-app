"use client";

import { useState } from "react";
import { ThoughtChain } from "@ant-design/x";
import type { ThoughtChainItemType } from "@ant-design/x";
import type { BubbleExtra } from "../_lib/mapMessages";

const TOOL_LABELS: Record<string, string> = {
  // Policy / legacy market chat tools
  search_policy: "搜索政策文档",
  analyze_market: "分析市场数据",
  compare_markets: "对比市场",
  list_products: "列出产品",
  analyze_brands: "分析品牌",
  browse_keywords: "浏览关键词",
  // Selection Agent tools (Sprint 2026-04-04, #111 / #112 / #113)
  market_intelligence: "查询市场数据",
  profit_calculator: "计算利润",
  timing_intelligence: "查询时机",
};

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

interface Props {
  extra: BubbleExtra;
}

export default function ToolThoughtChain({ extra }: Props) {
  const { reasoningParts, toolParts, isStreaming } = extra;

  const hasReasoning = reasoningParts.length > 0;
  const hasTools = toolParts.length > 0;

  // Track expanded keys — open during streaming, collapse when done.
  // Uses React 19's "adjust state during render" pattern to avoid the
  // cascading-render trap of syncing state via useEffect.
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [showFullThinking, setShowFullThinking] = useState(false);
  const [prevStreamingKey, setPrevStreamingKey] = useState<string>(
    `${isStreaming}|${hasReasoning}`,
  );

  const currentKey = `${isStreaming}|${hasReasoning}`;
  if (currentKey !== prevStreamingKey) {
    const [wasStreaming] = prevStreamingKey.split("|");
    setPrevStreamingKey(currentKey);
    if (isStreaming && hasReasoning) {
      // Just entered streaming-with-reasoning → auto-expand
      setExpandedKeys(["thinking"]);
    } else if (!isStreaming && wasStreaming === "true") {
      // Streaming just ended → auto-collapse + reset
      setExpandedKeys([]);
      setShowFullThinking(false);
    }
  }

  if (!hasReasoning && !hasTools) return null;

  const items: ThoughtChainItemType[] = [];

  if (hasReasoning) {
    const thinkingText = reasoningParts.map((p) => p.text).join("\n\n");
    const isLong = thinkingText.length > 500;

    items.push({
      key: "thinking",
      title: isStreaming ? "思考中..." : "思考过程",
      status: isStreaming ? "loading" : "success",
      collapsible: true,
      blink: isStreaming,
      content: (
        <div className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">
          <div
            className={
              !showFullThinking && isLong && !isStreaming
                ? "max-h-40 overflow-hidden"
                : undefined
            }
          >
            {thinkingText}
          </div>
          {isLong && !showFullThinking && !isStreaming && (
            <button
              onClick={() => setShowFullThinking(true)}
              className="text-xs text-blue-500 mt-1 hover:underline"
            >
              显示更多
            </button>
          )}
        </div>
      ),
    });
  }

  for (let i = 0; i < toolParts.length; i++) {
    const part = toolParts[i];
    const isDone = part.state === "result";
    items.push({
      key: `tool-${i}-${part.toolName}`,
      title: getToolLabel(part.toolName),
      status: isDone ? "success" : "loading",
      blink: !isDone,
      collapsible: false,
    });
  }

  return (
    <div className="mb-3">
      <ThoughtChain
        items={items}
        line="dashed"
        expandedKeys={expandedKeys}
        onExpand={(keys) => setExpandedKeys(keys)}
        styles={{
          root: { fontSize: 13 },
        }}
      />
    </div>
  );
}
