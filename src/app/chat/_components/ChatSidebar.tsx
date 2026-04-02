"use client";

import { Conversations } from "@ant-design/x";
import type { ConversationItemType } from "@ant-design/x";

interface ConversationListItem {
  id: string;
  label: string;
  updated_at: string;
}

interface Props {
  conversations: ConversationListItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  onNew: () => void;
  onDelete: (key: string) => void;
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

export default function ChatSidebar({
  conversations,
  activeKey,
  onSelect,
  onNew,
  onDelete,
}: Props) {
  const items: ConversationItemType[] = conversations.map((c) => ({
    key: c.id,
    label: c.label || "新对话",
    group: getGroup(c.updated_at),
  }));

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">对话历史</span>
        <button
          onClick={onNew}
          className="text-sm text-brand-500 hover:text-brand-600 transition-colors"
        >
          + 新对话
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <Conversations
          items={items}
          activeKey={activeKey}
          onActiveChange={(key) => onSelect(key)}
          groupable
          menu={(conversation) => ({
            items: [
              {
                key: "delete",
                label: "删除",
                danger: true,
              },
            ],
            onClick: ({ key }) => {
              if (key === "delete") onDelete(conversation.key);
            },
          })}
        />
      </div>
    </div>
  );
}
