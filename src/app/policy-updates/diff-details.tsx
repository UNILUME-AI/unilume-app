"use client";

import { useState } from "react";

interface DiffDetailsProps {
  addedLines: number;
  removedLines: number;
  excerpts: string[];
  excerptsZh?: string[];
}

function ExcerptList({ excerpts }: { excerpts: string[] }) {
  return (
    <div className="mt-1.5 space-y-0.5">
      {excerpts.map((line, i) => {
        const isAdd = line.startsWith("+ ");
        const isRemove = line.startsWith("- ");
        return (
          <div
            key={i}
            className={`text-sm rounded px-2 py-0.5 break-words ${
              isAdd
                ? "bg-[#e1faed] text-[#069469]"
                : isRemove
                  ? "bg-[#fff2f0] text-[#c92e34] line-through"
                  : "bg-gray-50 text-gray-600"
            }`}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}

export default function DiffDetails({
  addedLines,
  removedLines,
  excerpts,
  excerptsZh,
}: DiffDetailsProps) {
  const [lang, setLang] = useState<"zh" | "en">(excerptsZh ? "zh" : "en");
  const activeExcerpts = lang === "zh" && excerptsZh ? excerptsZh : excerpts;

  return (
    <details className="mt-1.5">
      <summary className="text-sm text-gray-400 cursor-pointer select-none hover:text-gray-600">
        查看详情
      </summary>
      <div className="mt-1.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm">
            <span className="text-[#069469]">+{addedLines}</span>
            <span className="text-gray-400"> / </span>
            <span className="text-[#c92e34]">-{removedLines}</span>
            <span className="text-gray-400"> 行</span>
          </span>
          {excerptsZh && (
            <div className="flex gap-1">
              <button
                onClick={() => setLang("zh")}
                className={`px-2 py-0.5 rounded text-sm transition-colors ${
                  lang === "zh"
                    ? "bg-[#533afd] text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                中文
              </button>
              <button
                onClick={() => setLang("en")}
                className={`px-2 py-0.5 rounded text-sm transition-colors ${
                  lang === "en"
                    ? "bg-[#533afd] text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                English
              </button>
            </div>
          )}
        </div>
        <ExcerptList excerpts={activeExcerpts} />
      </div>
    </details>
  );
}
