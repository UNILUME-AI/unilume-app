"use client";

import { useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser, UserButton } from "@clerk/nextjs";

import { ChatProvider, useChatContext } from "./_lib/ChatContext";
import ChatSidebar from "./_components/ChatSidebar";
import LoginOverlay from "./_components/LoginOverlay";

/* ── Decorative background orbs ── */
function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute -top-40 -right-20 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-amber-200 to-orange-300 opacity-20 blur-[100px] animate-[orbFloat1_30s_ease-in-out_infinite]" />
      <div className="absolute -bottom-30 -left-15 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-blue-200 to-indigo-200 opacity-15 blur-[100px] animate-[orbFloat2_35s_ease-in-out_infinite]" />
      <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-purple-200 to-fuchsia-200 opacity-10 blur-[100px] animate-[orbFloat3_40s_ease-in-out_infinite]" />
    </div>
  );
}

/* ── Inner layout that consumes ChatContext ── */
function ChatShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useUser();
  const {
    conversationList,
    refreshConversationList,
    sidebarOpen,
    setSidebarOpen,
    showSignIn,
    setShowSignIn,
  } = useChatContext();

  // Auto-dismiss login overlay after successful auth
  useEffect(() => {
    if (isLoaded && isSignedIn && showSignIn) {
      setShowSignIn(false);
    }
  }, [isLoaded, isSignedIn, showSignIn, setShowSignIn]);

  // Derive active conversation id from URL (/chat/[id])
  const activeKey = pathname.startsWith("/chat/")
    ? pathname.replace("/chat/", "")
    : "";

  const handleNew = useCallback(() => {
    router.push("/new");
  }, [router]);

  const handleSelect = useCallback(
    (key: string) => {
      router.push(`/chat/${key}`);
      if (window.innerWidth < 768) setSidebarOpen(false);
    },
    [router, setSidebarOpen],
  );

  const handleDelete = useCallback(
    async (key: string) => {
      try {
        await fetch(`/api/conversations?id=${key}`, { method: "DELETE" });
        await refreshConversationList();
        if (activeKey === key) router.push("/new");
      } catch {
        // Silently fail
      }
    },
    [activeKey, router, refreshConversationList],
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      <BackgroundOrbs />

      <ChatSidebar
        conversations={conversationList}
        activeKey={activeKey}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        onSelect={handleSelect}
        onNew={handleNew}
        onDelete={handleDelete}
        bottomSlot={isLoaded && isSignedIn ? <UserButton /> : undefined}
      />

      <div className="relative z-10 flex flex-col flex-1 min-w-0 overflow-hidden">
        {showSignIn && isLoaded && !isSignedIn && (
          <LoginOverlay onClose={() => setShowSignIn(false)} />
        )}
        {children}
      </div>
    </div>
  );
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatProvider>
      <ChatShell>{children}</ChatShell>
    </ChatProvider>
  );
}
