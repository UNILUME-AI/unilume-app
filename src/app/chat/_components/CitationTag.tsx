"use client";

import { Popover } from "antd";
import { SourceRef } from "../_lib/types";

export default function CitationTag({ source }: { source: SourceRef }) {
  const label =
    source.title.length > 20
      ? source.title.slice(0, 18) + "…"
      : source.title;

  let domain: string;
  try {
    domain = new URL(source.url).hostname;
  } catch {
    domain = source.url;
  }

  const popoverContent = (
    <div className="w-64">
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-3 w-3"
        >
          <path d="M1 4.75C1 3.784 1.784 3 2.75 3h10.5c.966 0 1.75.784 1.75 1.75v6.5A1.75 1.75 0 0 1 13.25 13H2.75A1.75 1.75 0 0 1 1 11.25v-6.5Zm12 0a.25.25 0 0 0-.25-.25H2.75a.25.25 0 0 0-.25.25v6.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-6.5Z" />
        </svg>
        {domain}
      </div>
      <p className="text-sm font-medium text-gray-900 leading-snug mb-1">
        {source.title}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-brand-500">点击查看原文 →</span>
        {source.modifiedTime && (
          <span className="text-[10px] text-gray-400">
            更新于 {source.modifiedTime.slice(0, 10)}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      trigger="hover"
      placement="top"
      overlayInnerStyle={{ padding: 12, borderRadius: 12 }}
    >
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-500 no-underline hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer leading-tight mx-0.5 align-baseline"
      >
        <span className="font-medium text-gray-400">{source.index}</span>
        <span className="hidden sm:inline truncate max-w-[120px]">
          {label}
        </span>
      </a>
    </Popover>
  );
}
