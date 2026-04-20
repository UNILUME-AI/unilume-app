"use client";

import { useState } from "react";
import { InputNumber, Segmented, Button } from "antd";
import type { Market } from "@/lib/selection/mock/types";

export type Fulfillment = "fbn" | "self";

export interface InfoGatherPayload {
  market: Market;
  costMinRmb: number;
  costMaxRmb: number;
  fulfillment: Fulfillment;
}

export interface InfoGatherProps {
  /** If provided, the Market row is hidden (market already chosen upstream). */
  market?: Market;
  /** Custom title — defaults to standard prompt. */
  title?: string;
  onSubmit: (payload: InfoGatherPayload) => void;
}

/**
 * Form for collecting missing inputs — market (if unknown), purchase
 * cost range, fulfillment method. Submit button disabled until all
 * required fields are valid.
 *
 * Design principle: never auto-guess for the user. Even "standard"
 * defaults (FBN) stay unselected until explicitly picked — forcing the
 * user to engage with each field reduces downstream surprises.
 */
export default function InfoGather({
  market: marketProp,
  title = "还需要几个信息，才能给你完整分析",
  onSubmit,
}: InfoGatherProps) {
  const [market, setMarket] = useState<Market | null>(marketProp ?? null);
  const [costMin, setCostMin] = useState<number | null>(null);
  const [costMax, setCostMax] = useState<number | null>(null);
  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null);

  const isValid =
    (marketProp !== undefined || market !== null) &&
    costMin !== null &&
    costMin > 0 &&
    costMax !== null &&
    costMax >= costMin &&
    fulfillment !== null;

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit({
      market: (marketProp ?? market) as Market,
      costMinRmb: costMin!,
      costMaxRmb: costMax!,
      fulfillment: fulfillment!,
    });
  };

  return (
    <div className="my-3 rounded-xl border border-dashed border-[var(--border-hover)] bg-[color-mix(in_srgb,var(--brand)_3%,var(--card))] p-4">
      <h4 className="mb-3 flex items-center gap-1.5 text-[14px] font-semibold text-[var(--ink)]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
        {title}
      </h4>

      {/* Market row — only if not preset */}
      {marketProp === undefined && (
        <Row label="目标市场">
          <Segmented<Market>
            options={[
              { label: "UAE", value: "UAE" },
              { label: "KSA", value: "KSA" },
            ]}
            value={market ?? undefined}
            onChange={(v) => setMarket(v)}
            size="small"
          />
        </Row>
      )}

      {/* Cost range */}
      <Row label="采购成本">
        <InputNumber
          min={1}
          step={1}
          size="small"
          placeholder="30"
          value={costMin}
          onChange={(v) => setCostMin(v ?? null)}
          style={{ width: 72 }}
        />
        <span className="text-[13px] text-[var(--ink3)]">–</span>
        <InputNumber
          min={1}
          step={1}
          size="small"
          placeholder="40"
          value={costMax}
          onChange={(v) => setCostMax(v ?? null)}
          style={{ width: 72 }}
        />
        <span className="text-[13px] text-[var(--ink3)]">元/件 (RMB)</span>
        <span className="ml-1 text-[11px] text-[var(--ink4)]">
          · 1688 按货源常有范围价
        </span>
      </Row>

      {/* Fulfillment */}
      <Row label="发货方式">
        <Segmented<Fulfillment>
          options={[
            { label: "FBN (仓配)", value: "fbn" },
            { label: "自发货 (DirectShip)", value: "self" },
          ]}
          value={fulfillment ?? undefined}
          onChange={(v) => setFulfillment(v)}
          size="small"
        />
      </Row>

      <Button
        type="primary"
        size="small"
        onClick={handleSubmit}
        disabled={!isValid}
        className="mt-2"
      >
        继续分析
      </Button>
    </div>
  );
}

// ─── Layout helper ──────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 py-1.5 text-[14px]">
      <span className="min-w-[72px] font-medium text-[var(--ink2)]">{label}</span>
      {children}
    </div>
  );
}
