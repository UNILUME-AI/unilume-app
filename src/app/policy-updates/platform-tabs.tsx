"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PLATFORMS = [
  { key: "noon", label: "Noon" },
  { key: "noon-ads", label: "Noon Ads" },
];

export default function PlatformTabs({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigate = (platform: string) => {
    const params = new URLSearchParams();
    if (platform !== "noon") params.set("platform", platform);
    // Don't carry date across platforms (different dates available)
    const url = params.toString()
      ? `/policy-updates?${params}`
      : "/policy-updates";
    router.push(url);
  };

  return (
    <div className="flex gap-1 border-b border-gray-200 mb-6">
      {PLATFORMS.map((p) => (
        <button
          key={p.key}
          onClick={() => navigate(p.key)}
          className={`px-4 py-2 text-sm font-medium transition-colors -mb-px ${
            current === p.key
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
