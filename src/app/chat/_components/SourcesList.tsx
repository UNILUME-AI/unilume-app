"use client";

import type { SourceRef } from "../_lib/types";

export default function SourcesList({ sources }: { sources: SourceRef[] }) {
  if (!sources.length) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-gray-400">
        {sources.length} 个来源
      </span>
      {sources.map((s) => (
        <a
          key={s.index}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-500 no-underline hover:bg-gray-100 hover:text-gray-700 transition-colors"
          title={s.title}
        >
          <span className="font-medium text-gray-400">{s.index}</span>
          <span className="truncate max-w-[100px]">{s.title}</span>
        </a>
      ))}
    </div>
  );
}
