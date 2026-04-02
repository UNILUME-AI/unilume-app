"use client";

import { Column } from "@ant-design/charts";
import { BRAND } from "@/config/colors";

interface PriceDistributionDataPoint {
  label: string;
  count: number;
}

interface PriceDistributionChartProps {
  data: PriceDistributionDataPoint[];
}

export default function PriceDistributionChart({
  data,
}: PriceDistributionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        暂无价格数据
      </div>
    );
  }

  return (
    <Column
      data={data}
      xField="label"
      yField="count"
      height={256}
      style={{ fill: BRAND[6], radiusTopLeft: 4, radiusTopRight: 4 }}
      axis={{
        y: { title: false, labelFormatter: (v: number) => `${v}` },
        x: { title: false },
      }}
      tooltip={{
        title: "label",
        items: [{ channel: "y", name: "产品数", valueFormatter: (v: number) => `${v} 个` }],
      }}
    />
  );
}
