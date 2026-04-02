"use client";

import { useState } from "react";
import Link from "next/link";

interface CategoryGroup {
  parent_code: string;
  parent_name: string;
  subcategories: {
    code: string;
    name: string;
    keywords: string[];
  }[];
}

const selectClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#7d63ff] focus:outline-none focus:ring-1 focus:ring-[#7d63ff] transition-colors";

export default function CategoryBrowser({ categories }: { categories: CategoryGroup[] }) {
  const [selectedParent, setSelectedParent] = useState("");
  const [selectedSub, setSelectedSub] = useState("");

  const activeParent = categories.find((c) => c.parent_code === selectedParent);
  const activeSub = activeParent?.subcategories.find((s) => s.code === selectedSub);

  // Collect keywords to display
  let displayKeywords: string[] = [];
  if (activeSub) {
    displayKeywords = activeSub.keywords;
  } else if (activeParent) {
    displayKeywords = activeParent.subcategories.flatMap((s) => s.keywords);
  }

  return (
    <div className="space-y-4">
      {/* Cascading selects */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Level 1 */}
        <select
          value={selectedParent}
          onChange={(e) => {
            setSelectedParent(e.target.value);
            setSelectedSub("");
          }}
          className={selectClass}
        >
          <option value="">选择品类</option>
          {categories.map((cat) => {
            const kwCount = cat.subcategories.reduce((s, sub) => s + sub.keywords.length, 0);
            return (
              <option key={cat.parent_code} value={cat.parent_code}>
                {cat.parent_name} ({kwCount})
              </option>
            );
          })}
        </select>

        {/* Level 2 */}
        {activeParent && (
          <>
            <span className="text-gray-300">/</span>
            <select
              value={selectedSub}
              onChange={(e) => setSelectedSub(e.target.value)}
              className={selectClass}
            >
              <option value="">全部子品类</option>
              {activeParent.subcategories.map((sub) => (
                <option key={sub.code} value={sub.code}>
                  {sub.name} ({sub.keywords.length})
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Keywords result */}
      {displayKeywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {displayKeywords.map((kw) => (
            <Link
              key={kw}
              href={`/market/${encodeURIComponent(kw)}`}
              className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-sm text-[#533afd] hover:border-[#c6b5ff] hover:bg-[#f4f0ff] transition-colors"
            >
              {kw}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
