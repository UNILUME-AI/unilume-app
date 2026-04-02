"use client";

import { Pie } from "@ant-design/charts";
import { CHART_COLORS } from "@/config/colors";

interface BrandDataPoint {
  brand: string;
  count: number;
  share_pct: number;
}

interface BrandPieChartProps {
  data: BrandDataPoint[];
}

function prepareData(data: BrandDataPoint[]) {
  if (data.length <= 8) return data;

  const top = data.slice(0, 8);
  const rest = data.slice(8);
  const otherCount = rest.reduce((sum, d) => sum + d.count, 0);
  const otherPct = rest.reduce((sum, d) => sum + d.share_pct, 0);

  return [
    ...top,
    { brand: "其他", count: otherCount, share_pct: otherPct },
  ];
}

export default function BrandPieChart({ data }: BrandPieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        暂无品牌数据
      </div>
    );
  }

  const chartData = prepareData(data);

  return (
    <Pie
      data={chartData}
      angleField="count"
      colorField="brand"
      height={256}
      innerRadius={0.5}
      label={{ text: "brand", position: "outside" }}
      scale={{ color: { range: [...CHART_COLORS] } }}
      legend={{ position: "right", layout: "vertical", size: 12 }}
      tooltip={{
        title: "brand",
        items: [
          {
            channel: "y",
            name: "产品数",
            valueFormatter: (v: number) => `${v} 个`,
          },
        ],
      }}
    />
  );
}
