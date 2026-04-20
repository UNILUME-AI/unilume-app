"use client";

import { Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";

import type { SceneId } from "@/lib/selection/mock/scenes";
import { useDetailPanel, type DetailPanelType } from "./DetailPanelContext";
import MarketDetail from "./MarketDetail";
import ProfitDetail from "./ProfitDetail";
import TimingDetail from "./TimingDetail";
import BasisDetail from "./BasisDetail";

export interface DetailPanelProps {
  /** Current scene — detail content reads its data by scene. */
  scene: SceneId;
}

const TITLES: Record<DetailPanelType, string> = {
  market: "市场分析",
  profit: "利润拆解",
  timing: "时机判断",
  basis: "建议依据",
};

/**
 * Inline side-column detail panel (Claude-style split layout).
 *
 * Rendered at the **same layout level** as <main> — not an overlay.
 *   Desktop (lg+): fixed 520px right column, border-l, independent scroll
 *   Mobile (<lg): takes full viewport below the SceneSwitcher, sliding in
 *
 * Consumer must render this panel as a flex-row sibling of the main
 * content, inside a parent that is `flex overflow-hidden` with enough
 * height (e.g. `h-dvh`). The `useDetailPanel` context controls whether
 * the aside is mounted at all — unmounted when closed to free scroll
 * position and save layout cost.
 */
export default function DetailPanel({ scene }: DetailPanelProps) {
  const { type, isOpen, close } = useDetailPanel();

  if (!isOpen || type === null) return null;

  return (
    <aside
      className={[
        // Mobile: absolute inside the parent split-row (which is `relative`),
        // covering main without doing viewport-level math. The parent sits
        // below the SceneSwitcher already, so we inherit the right top offset.
        "absolute inset-0 z-30 flex flex-col bg-white",
        // Desktop: real flex sibling — no absolute positioning, main shrinks to fit.
        "lg:static lg:inset-auto lg:z-auto lg:w-[520px] lg:flex-shrink-0 lg:border-l lg:border-[var(--border)]",
      ].join(" ")}
    >
      {/* Header — sticky so title + close stay visible while scrolling long panels */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[var(--border)] bg-white/95 px-4 py-3 backdrop-blur">
        <h2 className="truncate text-[15px] font-bold tracking-tight text-[var(--ink)]">
          {TITLES[type]}
        </h2>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={close}
        />
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {type === "market" && <MarketDetail scene={scene} />}
        {type === "profit" && <ProfitDetail scene={scene} />}
        {type === "timing" && <TimingDetail scene={scene} />}
        {type === "basis" && <BasisDetail scene={scene} />}
      </div>
    </aside>
  );
}
