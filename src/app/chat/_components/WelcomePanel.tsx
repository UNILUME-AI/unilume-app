"use client";

import { QUICK_ACTIONS } from "@/config/quick-actions";

interface WelcomePanelProps {
  onSend: (text: string) => void;
}

export default function WelcomePanel({ onSend }: WelcomePanelProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] sm:min-h-[60vh]">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">
        UNILUME
      </h1>
      <p className="text-sm text-gray-500 mb-1">
        助力你的电商决策
      </p>
      <p className="text-sm text-gray-400 mb-8 text-center max-w-md">
        关于 Noon 卖家政策、费用和流程的任何问题，都可以问我。
        基于 223+ 篇官方帮助文档。
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {QUICK_ACTIONS.map((action, i) => (
          <button
            key={i}
            onClick={() => onSend(action.text)}
            className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 shadow-sm hover:border-gray-300 hover:shadow-md transition-all"
          >
            <span className="text-base flex-none mt-0.5">
              {action.icon}
            </span>
            <span>{action.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
