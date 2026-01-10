"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Plus, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { fetchConversations, type ConversationPreview } from "@/lib/api";
import { useChatStore } from "@/stores/chat-store";

const CONVERSATIONS_CACHE_KEY = "clave_conversations_cache";

function getCachedConversations(): ConversationPreview[] {
  try {
    const cached = localStorage.getItem(CONVERSATIONS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

function setCachedConversations(conversations: ConversationPreview[]): void {
  try {
    localStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(conversations));
  } catch {
    // Ignore storage errors
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const {
    conversationId,
    pendingConversation,
    loadConversation,
    startNewConversation,
  } = useChatStore();

  const hasPendingConversation = !!pendingConversation;

  // Load cached conversations on mount, then fetch fresh data
  useEffect(() => {
    // Fetch fresh data, loading from cache first
    const load = async () => {
      // Load from cache immediately before async fetch
      const cached = getCachedConversations();
      console.log('[Sidebar] Cached conversations:', cached);
      if (cached.length > 0) {
        setConversations(cached);
      }

      try {
        const data = await fetchConversations();
        console.log('[Sidebar] Fetched conversations:', data);
        setConversations(data);
        setCachedConversations(data);
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
      }
    };
    load();
  }, [conversationId, hasPendingConversation]);

  const handleNewConversation = () => {
    startNewConversation();
    router.push("/copilot");
  };

  const handleConversationClick = (id: string) => {
    loadConversation(id);
    router.push("/copilot");
  };

  const isCopilotRoute = pathname === "/copilot";
  const isDashboardRoute = pathname === "/dashboard";

  // Determine which single item should be active (mutually exclusive)
  const isNewChatActive = isCopilotRoute && !conversationId && !pendingConversation;
  const isDashboardActive = isDashboardRoute;
  const isPendingActive = isCopilotRoute && !!pendingConversation;

  return (
    <div className="flex h-full w-56 flex-col border-r border-border bg-card dark:bg-background shrink-0">
      <nav className="flex-1 p-2 overflow-y-auto">
        <ul className="space-y-1">
          {/* Copilot - New Conversation */}
          <li>
            <button
              onClick={handleNewConversation}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                isNewChatActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Plus className="size-4" />
              New Chat
            </button>
          </li>

          {/* Dashboard */}
          <li className="pt-0">
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                isDashboardActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <LayoutDashboard className="size-4" />
              Dashboard
            </Link>
          </li>

          {/* Conversation History */}
          {(conversations.length > 0 || pendingConversation) && (
            <li className="pt-4">
              <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                History
              </div>
              <ul className="mt-0 space-y-0.5">
                {/* Pending conversation (optimistic) */}
                {pendingConversation && (
                  <li>
                    <div
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-left",
                        isPendingActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground"
                      )}
                      title={pendingConversation.preview}
                    >
                      <MessageCircle className="size-3 shrink-0 animate-pulse" />
                      <span className="truncate">
                        {pendingConversation.preview}
                      </span>
                    </div>
                  </li>
                )}
                {/* Existing conversations */}
                {conversations.map((conv) => {
                  const isActive =
                    conversationId === conv.id && isCopilotRoute;
                  const preview = conv.preview || "New conversation";

                  return (
                    <li key={conv.id}>
                      <button
                        onClick={() => handleConversationClick(conv.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200 text-left",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        title={preview}
                      >
                        <MessageCircle className="size-3 shrink-0" size={16} />
                        <span className="truncate">{preview}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}
