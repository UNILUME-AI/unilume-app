"use client";

import { useState, useRef, useEffect } from "react";
import type { BubbleExtra } from "../_lib/mapMessages";

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
    <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
  </svg>
);

export default function UserBubbleFooter({
  extra,
  content,
}: {
  extra: BubbleExtra;
  content: string;
}) {
  const { onEdit, messageId } = extra;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(editText.length, editText.length);
    }
  }, [editing, editText.length]);

  if (!onEdit) return null;

  if (editing) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="w-full min-w-[280px] rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] resize-none focus:outline-none focus:border-[var(--brand)]"
          rows={Math.min(editText.split("\n").length + 1, 6)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (editText.trim()) {
                onEdit(messageId, editText);
                setEditing(false);
              }
            }
            if (e.key === "Escape") {
              setEditing(false);
              setEditText(content);
            }
          }}
        />
        <div className="flex gap-1.5 justify-end">
          <button
            onClick={() => { setEditing(false); setEditText(content); }}
            className="rounded-lg px-3 py-1 text-xs text-[var(--ink2)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => {
              if (editText.trim()) {
                onEdit(messageId, editText);
                setEditing(false);
              }
            }}
            className="rounded-lg px-3 py-1 text-xs font-medium text-white bg-[var(--brand)] hover:opacity-90 transition-opacity"
          >
            提交
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 flex justify-end">
      <button
        onClick={() => setEditing(true)}
        className="rounded-lg p-1 text-gray-300 hover:text-gray-500 transition-colors opacity-0 group-hover:opacity-100"
        title="编辑"
      >
        <EditIcon />
      </button>
    </div>
  );
}
