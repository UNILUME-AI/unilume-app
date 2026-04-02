"use client";

import { ThoughtChain } from "@ant-design/x";
import type { ThoughtChainItemType } from "@ant-design/x";
import type { BubbleExtra } from "../_lib/mapMessages";

const TOOL_LABELS: Record<string, string> = {
  search_policy: "搜索政策文档",
  analyze_market: "分析市场数据",
  compare_markets: "对比市场",
  list_products: "列出产品",
  analyze_brands: "分析品牌",
  browse_keywords: "浏览关键词",
};

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

interface Props {
  extra: BubbleExtra;
}

/**
 * Header slot for AI bubbles — shows thinking process and tool calls
 * in a ThoughtChain before the final answer.
 * Display order: thinking → tool calls
 */
export default function ToolThoughtChain({ extra }: Props) {
  const { reasoningParts, toolParts } = extra;

  const hasReasoning = reasoningParts.length > 0;
  const hasTools = toolParts.length > 0;

  if (!hasReasoning && !hasTools) return null;

  const items: ThoughtChainItemType[] = [];

  // Thinking items — collapsed by default
  if (hasReasoning) {
    items.push({
      key: "thinking",
      title: "思考过程",
      status: "success",
      collapsible: true,
      content: (
        <div className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">
          {reasoningParts.map((p) => p.text).join("\n\n")}
        </div>
      ),
    });
  }

  // Tool call items
  for (let i = 0; i < toolParts.length; i++) {
    const part = toolParts[i];
    const isDone = part.state === "result";
    items.push({
      key: `tool-${i}-${part.toolName}`,
      title: getToolLabel(part.toolName),
      status: isDone ? "success" : "loading",
      collapsible: false,
    });
  }

  // Default expand keys: nothing (so thinking is collapsed by default)
  const defaultExpandedKeys: string[] = [];

  return (
    <div className="mb-3">
      <ThoughtChain
        items={items}
        defaultExpandedKeys={defaultExpandedKeys}
        styles={{
          root: { fontSize: 13 },
        }}
      />
    </div>
  );
}
