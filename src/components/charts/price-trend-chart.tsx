"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        range: d.p25 != null && d.p75 != null ? [d.p25, d.p75] : undefined,
      })),
    [data],
  );

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        暂无趋势数据
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <ComposedChart data={chartData}>
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => {
            const d = new Date(value);
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            return `${mm}-${dd}`;
          }}
          tick={{ fontSize: 12 }}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          labelFormatter={(label) => String(label)}
          formatter={(value, name) => {
            const labels: Record<string, string> = {
              median: "中位价",
              range: "P25–P75",
              p25: "P25",
              p75: "P75",
            };
            const key = String(name);
            if (Array.isArray(value)) {
              return [`${value[0]} – ${value[1]}`, labels[key] ?? key];
            }
            return [value, labels[key] ?? key];
          }}
        />
        <Area
          type="monotone"
          dataKey="range"
          stroke="none"
          fill="#bfdbfe"
          fillOpacity={0.5}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="median"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
