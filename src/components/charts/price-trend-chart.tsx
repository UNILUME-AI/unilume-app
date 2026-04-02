"use client";

import { Area } from "@ant-design/charts";
import { CHART_COLORS } from "@/config/colors";

interface PriceTrendDataPoint {
  date: string;
  median: number;
  p25: number | null;
  p75: number | null;
}

interface PriceTrendChartProps {
  data: PriceTrendDataPoint[];
}

export default function PriceTrendChart({ data }: PriceTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        暂无趋势数据
      </div>
    );
  }

  // Transform into long-form for area range + line overlay
  const chartData = data.flatMap((d) => {
    const date = d.date.length > 5 ? d.date.slice(5) : d.date;
    const items: { date: string; value: number; type: string }[] = [
      { date, value: d.median, type: "中位价" },
    ];
    if (d.p25 != null) items.push({ date, value: d.p25, type: "P25" });
    if (d.p75 != null) items.push({ date, value: d.p75, type: "P75" });
    return items;
  });

  return (
    <Area
      data={chartData}
      xField="date"
      yField="value"
      seriesField="type"
      height={256}
      shapeField="smooth"
      style={{ opacity: 0.6 }}
      scale={{ color: { range: [CHART_COLORS[0], "var(--color-brand-200)", "var(--color-brand-200)"] } }}
      legend={{ position: "top-right", size: 10 }}
      tooltip={{ title: "date" }}
      axis={{
        y: { title: false, labelFormatter: (v: number) => `${v}` },
        x: { title: false },
      }}
    />
  );
}
