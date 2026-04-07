"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { generateId } from "../_lib/helpers";
import { useChatContext } from "../_lib/ChatContext";
import WelcomePanel from "../_components/WelcomePanel";

const PENDING_MSG_KEY = "unilume_pending_message";

export default function NewChatPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded, user } = useUser();
  const { setShowSignIn, setPendingFirstMessage, addOptimisticConversation } = useChatContext();
  const [input, setInput] = useState("");

  const send = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      if (!isLoaded) return;

      if (!isSignedIn) {
        try { sessionStorage.setItem(PENDING_MSG_KEY, text.trim()); } catch {}
        setShowSignIn(true);
        return;
      }

      const trimmed = text.trim();
      setPendingFirstMessage(trimmed);
      const newId = generateId();
      addOptimisticConversation(newId, trimmed.slice(0, 50));
      router.push(`/chat/${newId}`);
    },
    [isLoaded, isSignedIn, setShowSignIn, setPendingFirstMessage, addOptimisticConversation, router],
  );

  // Auto-submit pending message after login redirect
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    try {
      const pending = sessionStorage.getItem(PENDING_MSG_KEY);
      if (pending) {
        sessionStorage.removeItem(PENDING_MSG_KEY);
        send(pending);
      }
    } catch {}
  }, [isLoaded, isSignedIn, send]);

  return (
    <main className="flex-1 overflow-hidden flex flex-col">
      <WelcomePanel
        onSend={send}
        input={input}
        onInputChange={setInput}
        isLoading={false}
        onCancel={() => {}}
        userName={user?.firstName}
      />
    </main>
  );
}
