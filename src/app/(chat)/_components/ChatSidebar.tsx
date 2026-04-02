"use client";

import type { ConversationListItem } from "../_lib/types";

interface Props {
  conversations: ConversationListItem[];
  activeKey: string;
  open: boolean;
  onToggle: () => void;
  onSelect: (key: string) => void;
  onNew: () => void;
  onDelete: (key: string) => void;
  bottomSlot?: React.ReactNode;
}

function getGroup(updatedAt: string): string {
  const now = new Date();
  const date = new Date(updatedAt);
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  return "更早";
}

/* ── Icon helpers ── */
const PanelLeftIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

const ChatIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ChatSidebar({
  conversations,
  activeKey,
  open,
  onToggle,
  onSelect,
  onNew,
  onDelete,
  bottomSlot,
}: Props) {
  // Group conversations
  const grouped = conversations.reduce<Record<string, ConversationListItem[]>>(
    (acc, c) => {
      const group = getGroup(c.updated_at);
      (acc[group] ??= []).push(c);
      return acc;
    },
    {},
  );
  const groupOrder = ["今天", "昨天", "更早"];

  return (
    <aside
      className="h-full flex flex-col border-r border-[var(--border)] bg-[var(--background)] transition-[width,min-width] duration-250 ease-[cubic-bezier(.16,1,.3,1)] overflow-hidden flex-shrink-0"
      style={{ width: open ? 260 : 48, minWidth: open ? 260 : 48 }}
    >
      {/* Top: logo + toggle + new chat */}
      <div className="p-2 flex flex-col gap-1" style={{ alignItems: open ? "stretch" : "center" }}>
        {/* Logo row */}
        <div className="flex items-center h-9" style={{ justifyContent: open ? "space-between" : "center", padding: open ? "0 2px" : 0 }}>
          {open && (
            <span className="text-[15px] font-bold text-[var(--ink)] tracking-[-0.02em] whitespace-nowrap overflow-hidden">
              UNILUME
            </span>
          )}
          <button
            onClick={onToggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink2)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-[var(--ink)] transition-all flex-shrink-0"
          >
            <PanelLeftIcon />
          </button>
        </div>

        {/* New chat button */}
        <button
          onClick={onNew}
          className={`flex items-center justify-center gap-1.5 rounded-lg transition-all duration-200 text-[var(--ink2)] ${
            open
              ? "px-3 py-[7px] border border-[var(--border)] bg-white hover:bg-[var(--brand-soft)] hover:border-[color-mix(in_srgb,var(--brand)_20%,transparent)] hover:text-[var(--brand)]"
              : "w-8 h-8 hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-[var(--ink)]"
          }`}
        >
          <PlusIcon />
          {open && <span className="text-[12.5px] font-medium">新对话</span>}
        </button>
      </div>

      {/* Conversation list — hidden when collapsed */}
      {open && (
        <>
          <div className="px-2 mt-2">
            <div className="text-[10px] font-semibold text-[var(--ink4)] tracking-[0.04em] uppercase px-1 pb-1.5">
              最近对话
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {conversations.length === 0 && (
              <div className="py-5 text-center text-[11px] text-[var(--ink4)]">
                暂无对话记录
              </div>
            )}
            {groupOrder.map((group) => {
              const items = grouped[group];
              if (!items?.length) return null;
              return (
                <div key={group} className="mb-1">
                  <div className="text-[10px] font-semibold text-[var(--ink4)] tracking-[0.04em] uppercase px-2 py-1">
                    {group}
                  </div>
                  {items.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onSelect(c.id)}
                      className={`group w-full flex items-center gap-2 px-2 py-[7px] rounded-lg text-[12.5px] transition-all ${
                        activeKey === c.id
                          ? "bg-[var(--brand-soft)] text-[var(--brand)] font-medium"
                          : "text-[var(--ink2)] hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-[var(--ink)]"
                      }`}
                    >
                      <span className="flex-shrink-0 opacity-60"><ChatIcon /></span>
                      <span className="flex-1 truncate text-left leading-[1.4]">
                        {c.label || "新对话"}
                      </span>
                      <span
                        onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-[22px] h-[22px] rounded-[5px] flex items-center justify-center text-[var(--ink4)] hover:text-red-500 hover:bg-red-500/5 transition-all cursor-pointer"
                      >
                        <TrashIcon />
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Bottom: user slot */}
      <div
        className="p-2 border-t border-[var(--border)] flex items-center gap-2 mt-auto"
        style={{ justifyContent: open ? "flex-start" : "center" }}
      >
        {bottomSlot}
        {!bottomSlot && (
          <div className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 cursor-pointer">
            U
          </div>
        )}
      </div>
    </aside>
  );
}
