"use client";

import {
  LoadingOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleOutlined,
} from "@ant-design/icons";
import type {
  SelectionAgentState,
  ToolName,
  ToolStatus,
} from "@/lib/selection/mock/events";

export interface ToolProgressStripProps {
  tools: SelectionAgentState["tools"];
  hints: SelectionAgentState["toolHints"];
  elapsed: SelectionAgentState["toolElapsed"];
  /** Hide this component when all tools have terminated AND you want it to fade away. */
  hideWhenDone?: boolean;
}

const LABELS: Record<ToolName, string> = {
  market_intelligence: "市场数据",
  profit_calculator: "利润计算",
  timing_intelligence: "时机判断",
};

// Order: profit/timing first (fast), market last (slow). Matches stream.
const ORDER: ToolName[] = ["profit_calculator", "timing_intelligence", "market_intelligence"];

/**
 * Compact 3-row list showing each tool's status while the Agent is
 * analyzing. Once all tools terminate, either stays as a "done" summary
 * or hides (via `hideWhenDone`).
 *
 * This is a lightweight preview of what `ToolThoughtChain` will do in
 * the full chat flow (Phase 5.2). Deliberately NOT the antd-x
 * ThoughtChain component because that one expects a `BubbleExtra`
 * shape tied to AI SDK messages.
 */
export default function ToolProgressStrip({
  tools,
  hints,
  elapsed,
  hideWhenDone = false,
}: ToolProgressStripProps) {
  const allDone = Object.values(tools).every((s) => s === "success" || s === "error");
  if (hideWhenDone && allDone) return null;
  if (Object.values(tools).every((s) => s === "pending")) return null;

  return (
    <section className="my-3 rounded-lg border border-[var(--border)] bg-white px-4 py-3">
      <header className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--ink3)]">
        {allDone ? "分析完成" : "分析中…"}
      </header>
      <ul className="space-y-1.5">
        {ORDER.map((tool) => (
          <ToolRow
            key={tool}
            name={LABELS[tool]}
            status={tools[tool]}
            hint={hints[tool]}
            elapsedMs={elapsed[tool]}
          />
        ))}
      </ul>
    </section>
  );
}

function ToolRow({
  name,
  status,
  hint,
  elapsedMs,
}: {
  name: string;
  status: ToolStatus;
  hint: string;
  elapsedMs: number | null;
}) {
  const icon = ICONS[status];
  const hintColor =
    status === "success"
      ? "text-emerald-600"
      : status === "error"
        ? "text-red-600"
        : status === "running"
          ? "text-[var(--brand)]"
          : "text-[var(--ink4)]";

  return (
    <li className="flex items-center gap-2 text-[13px]">
      <span className="w-4 flex-shrink-0">
        {icon}
      </span>
      <span className="min-w-[72px] font-medium text-[var(--ink2)]">{name}</span>
      <span className={`flex-1 truncate ${hintColor}`}>
        {status === "pending" && "等待中"}
        {status === "running" && (hint || "分析中…")}
        {status === "success" && (hint || "完成")}
        {status === "error" && (hint || "获取失败")}
      </span>
      {elapsedMs !== null && status === "success" && (
        <span className="text-[11px] tabular-nums text-[var(--ink4)]">
          {(elapsedMs / 1000).toFixed(1)}s
        </span>
      )}
    </li>
  );
}

const ICONS: Record<ToolStatus, React.ReactNode> = {
  pending: <ClockCircleOutlined className="text-[var(--ink4)]" />,
  running: <LoadingOutlined className="text-[var(--brand)]" />,
  success: <CheckCircleFilled className="text-emerald-500" />,
  error: <CloseCircleFilled className="text-red-500" />,
};
