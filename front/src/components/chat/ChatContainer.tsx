"use client";

import { useEffect } from "react";
import { useChatStore } from "@/stores/chat-store";

import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

export function ChatContainer() {
  const messages = useChatStore((state) => state.messages);
  const isLoading = useChatStore((state) => state.isLoading);
  const sendMessage = useChatStore((state) => state.sendMessage);

  // Log all messages to console every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("[Messages]", messages);
    }, 10000);

    return () => clearInterval(interval);
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      <MessageList
        messages={messages}
        isLoading={isLoading}
        onSendMessage={sendMessage}
      />
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
