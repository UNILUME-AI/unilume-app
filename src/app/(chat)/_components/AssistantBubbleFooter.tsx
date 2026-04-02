"use client";

import type { BubbleExtra } from "../_lib/mapMessages";
import SourcesList from "./SourcesList";
import MarketDataCard from "./MarketDataCard";

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.598a.75.75 0 0 0-.75.75v3.634a.75.75 0 0 0 1.5 0v-2.033l.312.311a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm-10.625-2.85a5.5 5.5 0 0 1 9.201-2.466l.312.311H11.767a.75.75 0 0 0 0 1.5h3.634a.75.75 0 0 0 .75-.75V3.535a.75.75 0 0 0-1.5 0v2.033l-.312-.311A7 7 0 0 0 2.627 8.395a.75.75 0 0 0 1.449.39Z" clipRule="evenodd" />
  </svg>
);

export default function AssistantBubbleFooter({
  extra,
}: {
  extra: BubbleExtra;
}) {
  const { messageId, sources, feedbackState, onFeedback, onRegenerate, isStreaming, marketDataLink } = extra;

  if (!sources.length && !messageId) return null;

  return (
    <div>
      {marketDataLink ? <MarketDataCard link={marketDataLink} /> : <SourcesList sources={sources} />}

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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 rotate-180">
            <path d="M1 8.998a1 1 0 0 1 1-1h3v9H2a1 1 0 0 1-1-1v-7Zm5.5 8.25 1.816-4.538A1 1 0 0 0 7.382 11H13.5a1 1 0 0 0 .979-.803l1.333-6.222A1.5 1.5 0 0 0 14.348 2.5H9.5v4.25a.75.75 0 0 1-1.5 0V2.5H6.5v14.748Z" />
          </svg>
        </button>

        {/* Regenerate button — only on completed (non-streaming) messages */}
        {onRegenerate && !isStreaming && (
          <button
            onClick={() => onRegenerate(messageId)}
            className="rounded-lg p-1.5 text-gray-300 hover:text-gray-500 transition-colors"
            title="重新生成"
          >
            <RefreshIcon />
          </button>
        )}
      </div>
    </div>
  );
}
