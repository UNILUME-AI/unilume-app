"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/market/${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索关键词，如 bluetooth earphones, air fryer ..."
        className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#7d63ff] focus:outline-none focus:ring-1 focus:ring-[#7d63ff]"
      />
      <button
        type="submit"
        disabled={!query.trim()}
        className="flex-none rounded-xl bg-[#533afd] px-5 py-3 text-sm font-medium text-white hover:bg-[#3827d6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        搜索
      </button>
    </form>
  );
}
