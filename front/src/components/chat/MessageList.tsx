"use client";

import { useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import type { Message } from "@/types/chat";
import { Badge } from "@/components/ui/badge";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { useThemeStore } from "@/stores/theme-store";

const EXAMPLE_QUERIES = [
  "What was the revenue yesterday?",
  "List the top 10 selling items",
  "What are the top selling items at the Mall?",
  "Show me total sales by location",
  "What were hourly sales on the 3rd?",
  "Show me sales for January 2nd",
  "Which location had the highest sales?",
  "Show me sales comparison between Downtown and Airport locations",
  "Show me Downtown vs University revenue",
  "Compare delivery vs dine-in revenue",
  "Show me takeout orders by location",
  "Which category generates the most revenue?",
  "Graph hourly sales for Friday vs Saturday at all stores",
  "Graph daily revenue for the first week",
  "Show me beverage sales across all locations",
  "How much came from DoorDash?",
  "Show me peak hours for each location",
  "What's the average order value by channel?",
  "Graph the trend of delivery orders over time",
  "Which payment methods are most popular?",
];

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage?: (message: string) => void;
}

export function MessageList({
  messages,
  isLoading,
  onSendMessage,
}: Readonly<MessageListProps>) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const isEmpty = messages.length === 0 && !isLoading;

  // Calculate total conversation cost
  const totalConversationCost = useMemo(() => {
    return messages.reduce((sum, msg) => sum + (msg.cost ?? 0), 0);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const theme = useThemeStore((state) => state.theme);

  const logoSrc =
    theme === "dark" ? "/clave-logo-icon_darkmode.png" : "/clave-logo-icon.png";

  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <div className="flex flex-col justify-center items-center">
          <div className="rounded-full w-fit">
            <Image
              src={logoSrc}
              alt="Clave"
              width={35}
              height={35}
              priority
              style={{ width: "auto", height: "100%" }}
            />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold">Got questions?</h2>
            <p className="text-muted-foreground">We&apos;ve got answers</p>
          </div>
        </div>
        <div className="flex max-w-4xl flex-wrap justify-center gap-2">
          {EXAMPLE_QUERIES.map((query) => (
            <Badge
              key={query}
              variant="secondary"
              className="cursor-pointer transition-colors hover:bg-primary hover:text-primary-foreground"
              onClick={() => onSendMessage?.(query)}
            >
              {query}
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        {messages.map((message, index) => {
          const isLastInBlock =
            index === messages.length - 1 ||
            messages[index + 1]?.role !== message.role;

          // Find all messages in the current block (same role)
          let blockStartIndex = index;
          while (
            blockStartIndex > 0 &&
            messages[blockStartIndex - 1]?.role === message.role
          ) {
            blockStartIndex--;
          }

          let blockEndIndex = index;
          while (
            blockEndIndex < messages.length - 1 &&
            messages[blockEndIndex + 1]?.role === message.role
          ) {
            blockEndIndex++;
          }

          // Collect all charts from the block
          const blockMessages = messages.slice(
            blockStartIndex,
            blockEndIndex + 1
          );
          const blockCharts = blockMessages.flatMap((msg) => msg.charts || []);
          const hasChartsInBlock = blockCharts.length > 0;
          const blockContent = blockMessages
            .map((msg) => msg.content)
            .join("\n\n");

          const nextMessage = !isLastInBlock ? messages[index + 1] : undefined;

          return (
            <MessageBubble
              key={message.id}
              message={message}
              isLastInBlock={isLastInBlock}
              hasChartsInBlock={hasChartsInBlock}
              blockCharts={blockCharts}
              blockContent={blockContent}
              isLoading={isLoading}
              nextMessage={nextMessage}
              totalConversationCost={totalConversationCost > 0 ? totalConversationCost : undefined}
            />
          );
        })}
        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
