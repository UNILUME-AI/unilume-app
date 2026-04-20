"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Bubble, Sender } from "@ant-design/x";
import type { BubbleItemType, BubbleListProps } from "@ant-design/x";
import { Avatar, Empty } from "antd";
import { RobotOutlined, UserOutlined } from "@ant-design/icons";

import { isSceneId, SCENE_META, type SceneId } from "@/lib/selection/mock/scenes";
import { getMockMarketResponse } from "@/lib/selection/mock/market-data";
import { getMockProfitResponse } from "@/lib/selection/mock/profit-data";
import { getMockTimingResponse } from "@/lib/selection/mock/timing-data";
import { getSceneUIState } from "@/lib/selection/mock/ui-state";

import SceneSwitcher from "./_components/SceneSwitcher";
import VerdictHeader from "@/components/selection/VerdictHeader";
import FallbackCard from "@/components/selection/FallbackCard";
import CostTrack from "@/components/selection/CostTrack";
import FollowUpPills from "@/components/selection/FollowUpPills";
import ZonedStatBar from "@/components/selection/ZonedStatBar";
import PriceRangeBar from "@/components/selection/PriceRangeBar";
import SubCategoryPicker from "@/components/selection/SubCategoryPicker";
import MarketPicker from "@/components/selection/MarketPicker";
import InfoGather from "@/components/selection/InfoGather";
import PriceCompare from "@/components/selection/PriceCompare";
import AnalysisCardStack from "@/components/selection/AnalysisCardStack";
import ToolProgressStrip from "@/components/selection/ToolProgressStrip";
import DetailPanel from "@/components/selection/panels/DetailPanel";
import { DetailPanelProvider, useDetailPanel } from "@/components/selection/panels/DetailPanelContext";
import { useMockSelectionAgent } from "./_hooks/useMockSelectionAgent";
import type { SelectionAgentState } from "@/lib/selection/mock/events";

/**
 * /mock/selection — design-review harness for Sprint #124.
 *
 * Two sections:
 *   1. Bubble.List — canonical conversation UI (mirrors real chat)
 *   2. AtomicShowcase — component gallery for design review
 *
 * Sender at bottom is intentionally disabled — this is a mock harness,
 * not a live chat. Use the scene switcher up top to navigate flows.
 */
export default function MockSelectionPage() {
  return (
    <DetailPanelProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        <Suspense fallback={null}>
          <SceneSwitcher />
        </Suspense>
        <Suspense
          fallback={
            <div className="flex-1 p-8 text-center text-sm text-[var(--ink3)]">
              加载中…
            </div>
          }
        >
          <SceneShowcase />
        </Suspense>
      </div>
    </DetailPanelProvider>
  );
}

function SceneShowcase() {
  const searchParams = useSearchParams();
  const rawScene = searchParams.get("scene");
  const scene: SceneId = isSceneId(rawScene) ? rawScene : "happy";

  return (
    // Split row — main column (scrollable content + sender) + aside (detail panel).
    <div className="relative flex flex-1 min-h-0 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            <Conversation scene={scene} />
            <AtomicShowcase scene={scene} />
          </div>
        </main>
        <MockSenderBar />
      </div>
      <DetailPanel scene={scene} />
    </div>
  );
}

// ─── Conversation (Bubble.List) ────────────────────────────────

/**
 * Bubble.List rendering: one user bubble + one assistant bubble per
 * "round". For Phase 5.2 we only render one round per scene since the
 * mock doesn't support real follow-up threading yet.
 */
function Conversation({ scene }: { scene: SceneId }) {
  const agent = useMockSelectionAgent(scene);

  const items: BubbleItemType[] = useMemo(
    () => [
      {
        key: `user-${scene}`,
        role: "user",
        content: SCENE_META[scene].userQuery,
      },
      {
        key: `ai-${scene}`,
        role: "ai",
        // Content rendered entirely via role.ai.contentRender below.
        content: " ",
      },
    ],
    [scene],
  );

  const roles: BubbleListProps["role"] = useMemo(
    () => ({
      user: {
        placement: "end",
        variant: "filled",
        avatar: (
          <Avatar icon={<UserOutlined />} style={{ background: "#1f2937" }} />
        ),
        styles: {
          content: { borderRadius: 16, fontSize: 14, whiteSpace: "pre-wrap" },
        },
      },
      ai: {
        placement: "start",
        variant: "outlined",
        avatar: (
          <Avatar icon={<RobotOutlined />} style={{ background: "var(--brand)" }} />
        ),
        styles: {
          content: {
            borderRadius: 16,
            fontSize: 14,
            background: "transparent",
            border: "none",
            padding: 0,
            boxShadow: "none",
          },
        },
        contentRender: () => <AgentTurn scene={scene} agent={agent} />,
      },
    }),
    [agent, scene],
  );

  return (
    <Bubble.List
      items={items}
      role={roles}
      autoScroll={false}
      style={{ overflow: "visible" }}
    />
  );
}

/**
 * Everything the AI "says" for one round — narrative, tool progress,
 * verdict, cards, follow-ups, cost. Organized to mirror the real
 * streaming timeline so design review sees the same order users see.
 */
function AgentTurn({
  scene,
  agent,
}: {
  scene: SceneId;
  agent: SelectionAgentState;
}) {
  const market = getMockMarketResponse(scene);
  const profit = getMockProfitResponse(scene);
  const timing = getMockTimingResponse(scene);
  const ui = getSceneUIState(scene);
  const { open } = useDetailPanel();

  return (
    <div className="w-full space-y-0 text-[var(--ink)]">
      {agent.narrative && <AgentNarrativeLine text={agent.narrative} />}

      <ToolProgressStrip
        tools={agent.tools}
        hints={agent.toolHints}
        elapsed={agent.toolElapsed}
      />

      {agent.toolsDone && ui.degraded && (
        <FallbackCard
          reason={ui.degradedReason ?? "数据暂时不可用"}
          onRetry={() => console.log("[mock] retry clicked")}
        />
      )}

      {agent.analysisReady && (
        <>
          <VerdictHeader
            tone={ui.verdict.tone}
            recommendLabel={ui.verdict.recommendLabel}
            summary={ui.verdict.summary}
            onOpenBasis={() => open("basis")}
          />
          <AnalysisCardStack
            market={market}
            profit={profit}
            timing={timing}
            risks={ui.risks}
            hideMarketOnDegraded
          />
        </>
      )}

      {agent.followupsReady && (
        <>
          <FollowUpPills
            suggestions={ui.followUps}
            onPick={(text) => {
              console.log("[mock] follow-up picked:", text);
            }}
          />
          <CostTrack cost={ui.cost} />
        </>
      )}
    </div>
  );
}

function AgentNarrativeLine({ text }: { text: string }) {
  return (
    <p className="my-3 flex items-center gap-2 text-[14px] leading-relaxed text-[var(--ink2)]">
      <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--brand)] animate-pulse" />
      <span>{text}</span>
    </p>
  );
}

// ─── Bottom Sender bar (disabled in mock) ─────────────────────

function MockSenderBar() {
  return (
    <div className="flex-none px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border)] bg-white shadow-[0_2px_12px_rgba(0,0,0,.06)]">
        <Sender
          value=""
          placeholder="这是 mock 预览，追问请在真实 Chat 页中体验…"
          disabled
          submitType="enter"
          autoSize={{ minRows: 1, maxRows: 4 }}
        />
      </div>
      <p className="mt-2 text-center text-[11px] text-[var(--ink3)]">
        场景切换：顶部工具条 · 原子组件 gallery 在下方滚动查看
      </p>
    </div>
  );
}

// ─── Atomic Showcase (design-review gallery) ──────────────────

function AtomicShowcase({ scene }: { scene: SceneId }) {
  const market = getMockMarketResponse(scene);
  const profit = getMockProfitResponse(scene);
  const timing = getMockTimingResponse(scene);

  return (
    <div className="mt-10 border-t-2 border-dashed border-[var(--border)] pt-6">
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[var(--ink3)]">
        原子组件 Gallery（对话流之外的独立用法）
      </h2>

      <Section title="子类目选择（SubCategoryPicker）">
        {market.data?.subCategories && market.data.subCategories.length > 0 ? (
          <SubCategoryPicker
            options={market.data.subCategories}
            onSelect={(c) => console.log("[mock] subcategory picked:", c.name)}
          />
        ) : (
          <EmptyBlock reason="此场景无子类目数据" />
        )}
      </Section>

      <Section title="市场选择（MarketPicker）">
        <MarketPicker
          onSelect={(m) => console.log("[mock] market picked:", m.code)}
        />
      </Section>

      <Section title="信息收集（InfoGather）">
        <InfoGather
          onSubmit={(payload) => console.log("[mock] info gather submit:", payload)}
        />
      </Section>

      <Section title="价格模拟（PriceCompare · 独立用法）">
        {profit.data ? (
          <PriceCompare anchor={profit.data} />
        ) : (
          <EmptyBlock reason="此场景无利润数据" />
        )}
      </Section>

      <Section title="价格分布（PriceRangeBar · 独立用法）">
        {market.data?.priceDistribution ? (
          <PriceRangeBar distribution={market.data.priceDistribution} />
        ) : (
          <EmptyBlock reason="此场景无价格分布数据" />
        )}
      </Section>

      <Section title="广告 / FBN 指标（ZonedStatBar · 独立用法）">
        {market.data?.competition ? (
          <>
            <ZonedStatBar
              label="广告位占比"
              value={Math.round(market.data.competition.sponsoredPct * 100)}
              tag={
                market.data.competition.sponsoredPct >= 0.4
                  ? { text: "过饱和", kind: "high" }
                  : market.data.competition.sponsoredPct >= 0.2
                    ? { text: "中等", kind: "mid" }
                    : { text: "低", kind: "low" }
              }
              zones={[
                { fraction: 0.2, color: "low" },
                { fraction: 0.2, color: "mid" },
                { fraction: 0.6, color: "high" },
              ]}
              ticks={["0", "20% 低", "40% 高", "100%"]}
              note={`品类平均 20–30%，超过 40% 代表投放内卷严重。`}
            />
            <ZonedStatBar
              label="FBN / Express 渗透率"
              value={Math.round(market.data.competition.fbnPct * 100)}
              tag={{ text: "成长期", kind: "info" }}
              zones={[
                { fraction: 0.4, color: "info-a" },
                { fraction: 0.3, color: "info-b" },
                { fraction: 0.3, color: "info-c" },
              ]}
              ticks={["0", "40% 早期", "70% 成熟", "100%"]}
              note="配送体验已成主流标配，不用 FBN 很难竞争 Buybox。"
            />
          </>
        ) : (
          <EmptyBlock reason="此场景无竞争数据" />
        )}
      </Section>

      <Section title="Tool 响应（调试）" defaultCollapsed>
        <RawToolResponses market={market} profit={profit} timing={timing} />
      </Section>
    </div>
  );
}

// ─── Internals ────────────────────────────────────────────────

function Section({
  title,
  children,
  defaultCollapsed = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--ink3)]">
        {title}
      </h3>
      <details
        open={!defaultCollapsed}
        className="rounded-lg border border-[var(--border)] bg-white p-4 shadow-sm open:shadow-md"
      >
        <summary className="cursor-pointer list-none text-[11px] text-[var(--ink4)] hover:text-[var(--ink3)]">
          {defaultCollapsed ? "展开" : "收起"}
        </summary>
        <div className="mt-2">{children}</div>
      </details>
    </section>
  );
}

function EmptyBlock({ reason }: { reason: string }) {
  return (
    <Empty
      description={<span className="text-[12px] text-[var(--ink3)]">{reason}</span>}
      styles={{ image: { height: 48 } }}
    />
  );
}

function RawToolResponses({
  market,
  profit,
  timing,
}: {
  market: ReturnType<typeof getMockMarketResponse>;
  profit: ReturnType<typeof getMockProfitResponse>;
  timing: ReturnType<typeof getMockTimingResponse>;
}) {
  return (
    <div className="space-y-3">
      <ToolResponseDump name="market_intelligence" response={market} />
      <ToolResponseDump name="profit_calculator" response={profit} />
      <ToolResponseDump name="timing_intelligence" response={timing} />
    </div>
  );
}

function ToolResponseDump<T>({
  name,
  response,
}: {
  name: string;
  response: import("@/lib/selection/mock/types").ToolResponse<T>;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold text-[var(--ink2)]">
        {name} · status={response.status} · {response.metadata.latency_ms}ms ·{" "}
        {response.metadata.confidence}
      </div>
      <pre className="max-h-64 overflow-auto rounded bg-stone-50 p-2 text-[10px] leading-tight text-[var(--ink2)]">
        {JSON.stringify(response.data, null, 2)}
      </pre>
    </div>
  );
}
