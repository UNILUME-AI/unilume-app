"use client";

import type {
  MarketIntelligenceResponse,
  ProfitCalcResponse,
  TimingIntelResponse,
  RiskItem,
} from "@/lib/selection/mock/types";

import MarketAnalysisCard from "./MarketAnalysisCard";
import ProfitAnalysisCard from "./ProfitAnalysisCard";
import TimingAnalysisCard from "./TimingAnalysisCard";
import RiskAnalysisCard from "./RiskAnalysisCard";
import { useDetailPanel } from "./panels/DetailPanelContext";

export interface AnalysisCardStackProps {
  market: MarketIntelligenceResponse;
  profit: ProfitCalcResponse;
  timing: TimingIntelResponse;
  risks: RiskItem[];
  /** Hide the Market card when the tool returned partial/error. */
  hideMarketOnDegraded?: boolean;
}

/**
 * Aggregator that stacks the four analysis cards in canonical order:
 *   Market → Profit → Timing → Risks
 *
 * Wires each card's `onOpenDetail` to the DetailPanelProvider via
 * `useDetailPanel()`. Must be rendered inside a <DetailPanelProvider>.
 *
 * The `hideMarketOnDegraded` flag handles the degraded scene's UX:
 * rather than showing a half-empty market card, the FallbackCard above
 * (rendered by the parent) tells the story and we skip the market slot.
 */
export default function AnalysisCardStack({
  market,
  profit,
  timing,
  risks,
  hideMarketOnDegraded = false,
}: AnalysisCardStackProps) {
  const { open } = useDetailPanel();

  const showMarket = !(hideMarketOnDegraded && market.status !== "success");

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {showMarket && (
        <MarketAnalysisCard
          response={market}
          onOpenDetail={() => open("market")}
        />
      )}
      <ProfitAnalysisCard
        response={profit}
        onOpenDetail={() => open("profit")}
      />
      <TimingAnalysisCard
        response={timing}
        onOpenDetail={() => open("timing")}
      />
      <RiskAnalysisCard risks={risks} />
    </div>
  );
}
