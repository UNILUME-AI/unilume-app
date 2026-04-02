"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { generateId } from "../_lib/helpers";
import { useChatContext } from "../_lib/ChatContext";
import WelcomePanel from "../_components/WelcomePanel";

export default function NewChatPage() {
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const { setShowSignIn, setPendingFirstMessage, addOptimisticConversation } = useChatContext();
  const [input, setInput] = useState("");

  const send = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      if (!isSignedIn) {
        setShowSignIn(true);
        return;
      }

      const trimmed = text.trim();
      setPendingFirstMessage(trimmed);
      const newId = generateId();
      addOptimisticConversation(newId, trimmed.slice(0, 50));
      router.push(`/chat/${newId}`);
    },
    [isSignedIn, setShowSignIn, setPendingFirstMessage, addOptimisticConversation, router],
  );

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
