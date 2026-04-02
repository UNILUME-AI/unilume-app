"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import type { ConversationListItem, ChatMessage } from "./types";

interface ChatContextValue {
  /* conversation list */
  conversationList: ConversationListItem[];
  refreshConversationList: () => Promise<void>;
  /* sidebar */
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /* login overlay */
  showSignIn: boolean;
  setShowSignIn: (v: boolean) => void;
  /* pending first message (home → conversation hand-off) */
  pendingFirstMessage: string | null;
  setPendingFirstMessage: (msg: string | null) => void;
  /* optimistic sidebar insert */
  addOptimisticConversation: (id: string, label: string) => void;
  /* message cache */
  getCachedMessages: (id: string) => ChatMessage[] | null;
  setCachedMessages: (id: string, msgs: ChatMessage[]) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();

  const [conversationList, setConversationList] = useState<ConversationListItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null);

  const addOptimisticConversation = useCallback(
    (id: string, label: string) => {
      setConversationList((prev) => {
        if (prev.some((c) => c.id === id)) return prev;
        return [{ id, label, updated_at: new Date().toISOString() }, ...prev];
      });
    },
    [],
  );

  const messagesCacheRef = useRef(new Map<string, ChatMessage[]>());

  const getCachedMessages = useCallback(
    (id: string) => messagesCacheRef.current.get(id) ?? null,
    [],
  );

  const setCachedMessages = useCallback(
    (id: string, msgs: ChatMessage[]) => { messagesCacheRef.current.set(id, msgs); },
    [],
  );

  // Open sidebar on desktop
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (window.innerWidth >= 768) setSidebarOpen(true);
    }
  }, []);

  const refreshConversationList = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const { conversations } = await res.json();
      if (conversations) setConversationList(conversations);
    } catch {
      // Silently fail
    }
  }, []);

  // Load conversation list on sign-in
  useEffect(() => {
    if (isLoaded && isSignedIn) refreshConversationList();
  }, [isLoaded, isSignedIn, refreshConversationList]);

  return (
    <ChatContext.Provider
      value={{
        conversationList,
        refreshConversationList,
        sidebarOpen,
        setSidebarOpen,
        showSignIn,
        setShowSignIn,
        pendingFirstMessage,
        setPendingFirstMessage,
        addOptimisticConversation,
        getCachedMessages,
        setCachedMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
