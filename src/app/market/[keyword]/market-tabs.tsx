"use client";

import { useRouter } from "next/navigation";

const MARKETS = [
  { key: "UAE", label: "\u{1F1E6}\u{1F1EA} UAE" },
  { key: "KSA", label: "\u{1F1F8}\u{1F1E6} KSA" },
];

export default function MarketTabs({
  keyword,
  current,
}: {
  keyword: string;
  current: string;
}) {
  const router = useRouter();

  const navigate = (market: string) => {
    const url =
      market === "UAE"
        ? `/market/${encodeURIComponent(keyword)}`
        : `/market/${encodeURIComponent(keyword)}?market=${market}`;
    router.push(url);
  };

  return (
    <div className="flex gap-2">
      {MARKETS.map((m) => (
        <button
          key={m.key}
          onClick={() => navigate(m.key)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            current === m.key
              ? "bg-[#533afd] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
