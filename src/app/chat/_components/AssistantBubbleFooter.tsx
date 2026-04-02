"use client";

import type { BubbleExtra } from "../_lib/mapMessages";

/**
 * Footer for assistant bubbles: source tags + feedback buttons.
 */
export default function AssistantBubbleFooter({
  extra,
}: {
  extra: BubbleExtra;
}) {
  const { messageId, sources, feedbackState, onFeedback } = extra;

  if (!sources.length && !messageId) return null;

  return (
    <div>
      {sources.length > 0 && (
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
      )}

      <div className="mt-1.5 flex items-center gap-1">
        <button
          onClick={() => onFeedback(messageId, "up")}
          disabled={!!feedbackState}
          className={`rounded-lg p-1.5 transition-colors ${
            feedbackState === "up"
              ? "text-brand-500"
              : "text-gray-300 hover:text-gray-500"
          } disabled:cursor-default`}
          title="有帮助"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M1 8.998a1 1 0 0 1 1-1h3v9H2a1 1 0 0 1-1-1v-7Zm5.5 8.25 1.816-4.538A1 1 0 0 0 7.382 11H13.5a1 1 0 0 0 .979-.803l1.333-6.222A1.5 1.5 0 0 0 14.348 2.5H9.5v4.25a.75.75 0 0 1-1.5 0V2.5H6.5v14.748Z" />
          </svg>
        </button>
        <button
          onClick={() => onFeedback(messageId, "down")}
          disabled={!!feedbackState}
          className={`rounded-lg p-1.5 transition-colors ${
            feedbackState === "down"
              ? "text-[#c92e34]"
              : "text-gray-300 hover:text-gray-500"
          } disabled:cursor-default`}
          title="没帮助"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 rotate-180"
          >
            <path d="M1 8.998a1 1 0 0 1 1-1h3v9H2a1 1 0 0 1-1-1v-7Zm5.5 8.25 1.816-4.538A1 1 0 0 0 7.382 11H13.5a1 1 0 0 0 .979-.803l1.333-6.222A1.5 1.5 0 0 0 14.348 2.5H9.5v4.25a.75.75 0 0 1-1.5 0V2.5H6.5v14.748Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
