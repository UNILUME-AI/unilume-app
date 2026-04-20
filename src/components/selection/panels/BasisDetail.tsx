"use client";

import { Collapse, Tag } from "antd";

import type { SceneId } from "@/lib/selection/mock/scenes";
import { getMockMarketResponse } from "@/lib/selection/mock/market-data";
import { getMockProfitResponse } from "@/lib/selection/mock/profit-data";
import { getMockTimingResponse } from "@/lib/selection/mock/timing-data";

import { DPKV, DPSection } from "./_internals";

export interface BasisDetailProps {
  scene: SceneId;
}

/**
 * "Why is this Agent's conclusion what it is?" — the transparency view.
 * Gives users confidence in the recommendation by exposing:
 *   - Confidence level of each tool + overall
 *   - Data sources (what we looked at, how fresh, where it came from)
 *   - FAQ that surfaces common user concerns about trust
 *
 * This panel is the primary answer to "can I trust this Agent?" — the
 * philosophical core of treating users as collaborators, not consumers.
 */
export default function BasisDetail({ scene }: BasisDetailProps) {
  const market = getMockMarketResponse(scene);
  const profit = getMockProfitResponse(scene);
  const timing = getMockTimingResponse(scene);

  const overall = aggregateConfidence([
    market.metadata.confidence,
    profit.metadata.confidence,
    timing.metadata.confidence,
  ]);

  return (
    <>
      <DPSection title="置信度">
        <DPKV
          label="综合评估"
          value={
            <ConfidenceTag level={overall} />
          }
          note="基于样本量和数据新鲜度"
        />
        <DPKV
          label="市场数据"
          value={<ConfidenceTag level={market.metadata.confidence} />}
          note={market.metadata.confidence_note}
        />
        <DPKV
          label="利润计算"
          value={<ConfidenceTag level={profit.metadata.confidence} />}
          note={profit.metadata.confidence_note}
        />
        <DPKV
          label="时机数据"
          value={<ConfidenceTag level={timing.metadata.confidence} />}
          note={timing.metadata.confidence_note}
        />
      </DPSection>

      <DPSection title="数据来源">
        <DPKV
          label="市场数据"
          value={describeSource(market.metadata.data_source)}
          note={
            market.metadata.data_freshness
              ? new Date(market.metadata.data_freshness).toLocaleString("zh-CN")
              : undefined
          }
        />
        <DPKV
          label="佣金与物流费率"
          value="Noon 2026 官方费率表"
        />
        <DPKV
          label="中东节日日历"
          value="覆盖 2026–2028 三年"
        />
        <DPKV
          label="Google 搜索趋势"
          value={<span className="text-[var(--ink3)]">暂未接入</span>}
        />
      </DPSection>

      <DPSection title="常见问题">
        <Collapse
          size="small"
          ghost
          items={FAQ.map((f, i) => ({
            key: String(i),
            label: (
              <span className="text-[13px] font-medium text-[var(--ink)]">
                {f.q}
              </span>
            ),
            children: (
              <p className="text-[13px] leading-relaxed text-[var(--ink2)]">
                {f.a}
              </p>
            ),
          }))}
          defaultActiveKey={["0"]}
        />
      </DPSection>
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────

type ConfLevel = "high" | "medium" | "low";

function aggregateConfidence(levels: ConfLevel[]): ConfLevel {
  // Conservative: overall = min(levels).
  if (levels.includes("low")) return "low";
  if (levels.includes("medium")) return "medium";
  return "high";
}

function ConfidenceTag({ level }: { level: ConfLevel }) {
  const tokens: Record<ConfLevel, { text: string; color: string }> = {
    high: { text: "高", color: "green" },
    medium: { text: "中等", color: "blue" },
    low: { text: "低", color: "orange" },
  };
  const t = tokens[level];
  return (
    <Tag color={t.color} className="!mr-0">
      {t.text}
    </Tag>
  );
}

function describeSource(src: "cache" | "on_demand" | "static" | "api"): string {
  switch (src) {
    case "cache":
      return "7 天内缓存命中";
    case "on_demand":
      return "今天刚从 Noon 实时获取";
    case "static":
      return "静态配置（本地表）";
    case "api":
      return "第三方 API";
  }
}

const FAQ = [
  {
    q: "为什么是\u201c建议\u201d而非\u201c判断\u201d？",
    a: "Agent 看到的是公开市场数据，而你掌握自己的资金、供应链、风险偏好等产品之外的关键维度。所以 Agent 的位置是专业分析师，给出带理由的建议；最终要不要投入的决定，交在你手上。",
  },
  {
    q: "置信度低的时候该怎么用？",
    a: "低置信度下，Agent 会加\u201c约\u201d\u201c大概\u201d等限定词。建议把结论当作方向参考，先小批量测试 (50–100 件)，而不是一次性大批量投入。",
  },
  {
    q: "数据多久更新一次？",
    a: "市场数据默认缓存 7 天；你问新关键词时会实时获取。佣金和物流费率按月检查 Noon 官方更新。节日历为预算三年固定版本。",
  },
  {
    q: "利润计算偏差可能来自哪里？",
    a: "主要三个来源：(1) 汇率波动 ±2%；(2) 头程运费随重量和季节小幅变化；(3) 退货率按品类均值估算，单店实际会有差异。建议拿 Statement Report 对照 1-2 个月后校准。",
  },
];
