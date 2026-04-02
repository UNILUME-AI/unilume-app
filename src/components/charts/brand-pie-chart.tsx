"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#d97706",
  "#65a30d",
  "#0891b2",
  "#6366f1",
  "#9ca3af",
];

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
    <div className="flex h-64 items-center">
      {/* Chart: 60% */}
      <div className="w-[60%] h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="brand"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={2}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend: 40% */}
      <div className="w-[40%] flex flex-col gap-1.5 overflow-y-auto text-sm">
        {chartData.map((entry, index) => (
          <div key={entry.brand} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="truncate" title={entry.brand}>
              {entry.brand}
            </span>
            <span className="ml-auto shrink-0 text-gray-500">
              {entry.share_pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
