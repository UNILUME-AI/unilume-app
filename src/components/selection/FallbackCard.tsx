"use client";

import { Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

export interface FallbackCardProps {
  /** Why the degradation happened. Will be prefixed with "数据暂时不可用 · ". */
  reason: string;
  /** Optional retry handler. Button hidden if omitted. */
  onRetry?: () => void;
}

/**
 * Amber-banded warning card shown above the analysis when a tool
 * returned partial/error data. Tone is *informative*, not alarming —
 * tells the user what's missing and offers a retry path.
 */
export default function FallbackCard({ reason, onRetry }: FallbackCardProps) {
  return (
    <div className="my-2 rounded-lg border border-amber-300 bg-amber-50 border-l-[3px] border-l-amber-500 px-4 py-3 text-[14px] leading-relaxed text-[var(--ink)]">
      <span className="font-semibold text-amber-700">数据暂时不可用 · </span>
      <span>{reason}</span>
      {onRetry && (
        <div className="mt-2">
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={onRetry}
          >
            稍后重试
          </Button>
        </div>
      )}
    </div>
  );
}
