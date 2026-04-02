"use client";

import dynamic from "next/dynamic";

const PriceTrendChart = dynamic(
  () => import("@/components/charts/price-trend-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-gray-50 animate-pulse rounded-lg" />
    ),
  },
);
const PriceDistributionChart = dynamic(
  () => import("@/components/charts/price-distribution-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-gray-50 animate-pulse rounded-lg" />
    ),
  },
);
const BrandPieChart = dynamic(
  () => import("@/components/charts/brand-pie-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-gray-50 animate-pulse rounded-lg" />
    ),
  },
);

interface PriceTrendPoint {
  date: string;
  median: number;
  p25: number | null;
  p75: number | null;
}

interface PriceBucket {
  label: string;
  count: number;
}

interface BrandSlice {
  brand: string;
  count: number;
  share_pct: number;
}

export function PriceTrendSection({ data }: { data: PriceTrendPoint[] }) {
  return <PriceTrendChart data={data} />;
}

export function PriceDistributionSection({ data }: { data: PriceBucket[] }) {
  return <PriceDistributionChart data={data} />;
}

export function BrandPieSection({ data }: { data: BrandSlice[] }) {
  return <BrandPieChart data={data} />;
}
