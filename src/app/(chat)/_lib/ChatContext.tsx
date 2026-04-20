"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useUser } from "@clerk/nextjs";
import type { ConversationListItem, ChatMessage } from "./types";

// Module-level viewport subscription helpers for useSyncExternalStore.
// Keeping these outside the component gives stable references across renders.
const DESKTOP_MQ = "(min-width: 768px)";

function subscribeViewport(cb: () => void): () => void {
  const mq = window.matchMedia(DESKTOP_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getViewportSnapshot(): boolean {
  return window.matchMedia(DESKTOP_MQ).matches;
}

function getServerViewportSnapshot(): boolean {
  return false;  // SSR default: treat as mobile (sidebar closed)
}

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
  const [showSignIn, setShowSignIn] = useState(false);
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null);

  // Sidebar: viewport-driven default, user toggle overrides.
  // Viewport is an external system → useSyncExternalStore is the idiomatic
  // way to subscribe without cascading effects.
  const isDesktop = useSyncExternalStore(
    subscribeViewport,
    getViewportSnapshot,
    getServerViewportSnapshot,
  );
  const [userPreference, setUserPreference] = useState<boolean | null>(null);
  const sidebarOpen = userPreference ?? isDesktop;
  const setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>> = useCallback(
    (next) => {
      setUserPreference((prev) => {
        const current = prev ?? isDesktop;
        return typeof next === "function"
          ? (next as (v: boolean) => boolean)(current)
          : next;
      });
    },
    [isDesktop],
  );

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

  // Load conversation list on sign-in. `refreshConversationList` is async —
  // its setState happens inside the fetch-response callback, not in this
  // effect body. The eslint rule can't statically detect that, hence suppress.
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refreshConversationList();
    }
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
