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

export default function CategoryBrowser({ categories }: { categories: CategoryGroup[] }) {
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);

  const activeParent = categories.find(c => c.parent_code === selectedParent);
  const activeSub = activeParent?.subcategories.find(s => s.code === selectedSub);

  return (
    <div className="space-y-4">
      {/* Level 1: Top-level categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat.parent_code}
            onClick={() => {
              setSelectedParent(selectedParent === cat.parent_code ? null : cat.parent_code);
              setSelectedSub(null);
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedParent === cat.parent_code
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            {cat.parent_name}
            <span className={`ml-1.5 text-xs ${selectedParent === cat.parent_code ? "text-blue-200" : "text-gray-400"}`}>
              {cat.subcategories.reduce((sum, s) => sum + s.keywords.length, 0)}
            </span>
          </button>
        ))}
      </div>

      {/* Level 2: Subcategories */}
      {activeParent && (
        <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-blue-100">
          {activeParent.subcategories.map(sub => (
            <button
              key={sub.code}
              onClick={() => setSelectedSub(selectedSub === sub.code ? null : sub.code)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedSub === sub.code
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {sub.name}
              <span className="ml-1 text-gray-400">{sub.keywords.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Level 3: Keywords */}
      {activeSub && (
        <div className="flex flex-wrap gap-2 pl-8 border-l-2 border-blue-50">
          {activeSub.keywords.map(kw => (
            <Link
              key={kw}
              href={`/market/${encodeURIComponent(kw)}`}
              className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-sm text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              {kw}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
