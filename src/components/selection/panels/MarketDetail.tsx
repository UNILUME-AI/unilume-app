"use client";

import type { SceneId } from "@/lib/selection/mock/scenes";
import { getMockMarketResponse } from "@/lib/selection/mock/market-data";

import { DPKV, DPSection } from "./_internals";
import PriceRangeBar from "../PriceRangeBar";
import ZonedStatBar from "../ZonedStatBar";
import CompetitorTable from "./CompetitorTable";

export interface MarketDetailProps {
  scene: SceneId;
}

/**
 * Deep-dive view of the `market_intelligence` tool response. Renders
 * a richer projection of the same data as `MarketAnalysisCard`:
 *   - Overview KPIs
 *   - Price distribution (full PriceRangeBar + KVs)
 *   - Competition metrics (HHI, Top3 share, review barrier)
 *   - Sponsored / FBN zone bars with benchmark context
 *   - Top 10 competitor table (click row → Noon product page)
 *   - Seller distribution with insight line
 *   - Data source + confidence
 */
export default function MarketDetail({ scene }: MarketDetailProps) {
  const response = getMockMarketResponse(scene);
  const data = response.data;

  if (!data) {
    return (
      <p className="text-[13px] text-[var(--ink3)]">
        此场景没有市场数据 — 请重试实时获取或切换场景。
      </p>
    );
  }

  const currency = data.priceBand?.currency ?? "AED";

  return (
    <>
      <DPSection title="市场概览">
        <DPKV
          label="关键词 · 市场"
          value={`${data.keyword} · ${data.market}`}
          tone="strong"
        />
        {data.independentProductCount !== undefined && (
          <DPKV
            label="独立产品数"
            value={`约 ${data.independentProductCount}`}
            note="(去重后)"
          />
        )}
        {data.sellerCount !== undefined && (
          <DPKV
            label="卖家数"
            value={`约 ${data.sellerCount}`}
            note="(Buybox 赢家)"
          />
        )}
        {data.priceBand && (
          <DPKV
            label="主流价格带"
            value={`${data.priceBand.min}–${data.priceBand.max} ${data.priceBand.currency}`}
            note="(P25–P75)"
          />
        )}
        {data.medianPrice !== undefined && (
          <DPKV
            label="中位价"
            value={`${data.medianPrice} ${currency}`}
            tone="strong"
          />
        )}
      </DPSection>

      {data.priceDistribution && (
        <DPSection title="价格分布">
          <PriceRangeBar distribution={data.priceDistribution} />
          <DPKV
            label="建议定价"
            value={`${data.priceDistribution.suggestedPrice} ${data.priceDistribution.currency}`}
            note={`(${data.priceDistribution.suggestionReason})`}
            tone="strong"
          />
        </DPSection>
      )}

      {data.competition && (
        <>
          <DPSection title="竞争格局">
            <DPKV
              label="HHI 指数"
              value={data.competition.hhi.toFixed(2)}
              note={
                data.competition.hhi < 0.1
                  ? "(分散市场，好进入)"
                  : data.competition.hhi < 0.25
                    ? "(中等集中)"
                    : "(高度集中，谨慎)"
              }
            />
            <DPKV
              label="Top 3 卖家占比"
              value={`${(data.competition.top3SellerShare * 100).toFixed(0)}%`}
              note={
                data.competition.top3SellerShare < 0.3
                  ? "(无垄断者)"
                  : data.competition.top3SellerShare < 0.6
                    ? "(有领先者)"
                    : "(寡头)"
              }
            />
            <DPKV label="评论壁垒" value={`${data.competition.reviewBarrier} 条`} />
            <DPKV
              label="进入难度"
              value={
                data.competition.entryDifficulty === "low"
                  ? "低"
                  : data.competition.entryDifficulty === "mid"
                    ? "中等"
                    : "高"
              }
            />
          </DPSection>

          <DPSection title="广告与物流">
            <ZonedStatBar
              label="广告位 占比"
              value={Math.round(data.competition.sponsoredPct * 100)}
              tag={
                data.competition.sponsoredPct >= 0.4
                  ? { text: "过饱和", kind: "high" }
                  : data.competition.sponsoredPct >= 0.2
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
              value={Math.round(data.competition.fbnPct * 100)}
              tag={{ text: "成长期", kind: "info" }}
              zones={[
                { fraction: 0.4, color: "info-a" },
                { fraction: 0.3, color: "info-b" },
                { fraction: 0.3, color: "info-c" },
              ]}
              ticks={["0", "40% 早期", "70% 成熟", "100%"]}
              note="配送体验已成主流标配，不用 FBN 很难竞争 Buybox。"
            />
          </DPSection>
        </>
      )}

      {data.topCompetitors && data.topCompetitors.length > 0 && (
        <DPSection
          title={`Top ${data.topCompetitors.length} 竞品`}
          subtitle="按 Noon 搜索算法排名（默认）· 点击行跳转 Noon 商品页"
        >
          <CompetitorTable
            products={data.topCompetitors}
            currency={currency}
          />
        </DPSection>
      )}

      {data.topSellers && data.topSellers.length > 0 && (
        <DPSection title="卖家分布">
          <div className="mb-2 rounded bg-emerald-50 border-l-[3px] border-emerald-500 px-3 py-2 text-[12px] leading-relaxed text-[var(--ink)]">
            {summarizeSellers(data.topSellers)}
          </div>
          {data.topSellers.map((s) => (
            <DPKV
              key={s.rank}
              label={`${s.rank}. ${s.name}`}
              value={`${s.productCount} 个`}
              note={`${(s.sharePct * 100).toFixed(1)}%`}
            />
          ))}
        </DPSection>
      )}

      <DPSection title="数据来源">
        <DPKV
          label="数据源"
          value={response.metadata.data_source}
        />
        <DPKV
          label="置信度"
          value={response.metadata.confidence}
          note={response.metadata.confidence_note}
        />
        {response.metadata.data_freshness && (
          <DPKV
            label="采集时间"
            value={new Date(response.metadata.data_freshness).toLocaleString("zh-CN")}
          />
        )}
        <DPKV label="延迟" value={`${response.metadata.latency_ms}ms`} />
      </DPSection>
    </>
  );
}

function summarizeSellers(sellers: Array<{ sharePct: number }>): string {
  const top3 = sellers.slice(0, 3).reduce((s, x) => s + x.sharePct, 0);
  const rest = 1 - top3;
  const top3Pct = (top3 * 100).toFixed(0);
  const restPct = (rest * 100).toFixed(0);
  return `Top 3 卖家合计占 ${top3Pct}% 市场份额，其余 ${restPct}% 分散在尾部卖家 — ${top3 < 0.3 ? "竞争充分" : top3 < 0.6 ? "有领先者但非垄断" : "高度集中"}。`;
}
