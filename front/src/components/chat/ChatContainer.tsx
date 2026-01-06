"use client";

import { useChatStore } from "@/stores/chat-store";

import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

export function ChatContainer() {
  const messages = useChatStore((state) => state.messages);
  const isLoading = useChatStore((state) => state.isLoading);
  const sendMessage = useChatStore((state) => state.sendMessage);

  return (
    <div className="flex h-full flex-col bg-background">
      <MessageList
        messages={messages}
        isLoading={isLoading}
        onSendMessage={sendMessage}
      />
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
