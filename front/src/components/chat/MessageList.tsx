'use client';

import { useRef, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import type { Message } from '@/types/chat';
import { Badge } from '@/components/ui/badge';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

const EXAMPLE_QUERIES = [
  "Show me sales comparison between Downtown and Airport locations",
  "What were my top 5 selling products last week?",
  "Graph hourly sales for Friday vs Saturday at all stores",
  "Compare delivery vs dine-in revenue this month",
  "Show me total sales by location",
  "What was the revenue yesterday?",
  "List the top 10 selling items",
  "Compare sales between Downtown and Airport",
  "Show me Downtown vs University revenue",
  "Which location had the highest sales?",
  "Show me sales for January 2nd",
  "What were hourly sales on the 3rd?",
  "Graph daily revenue for the first week",
  "What are the top selling items at the Mall?",
  "Show me beverage sales across all locations",
  "Which category generates the most revenue?",
  "Compare delivery vs dine-in revenue",
  "How much came from DoorDash?",
  "Show me takeout orders by location",
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

export function MessageList({ messages, isLoading, onSendMessage }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const isEmpty = messages.length === 0 && !isLoading;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <div className="rounded-full bg-muted p-4">
          <MessageCircle className="size-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Got questions?</h2>
          <p className="text-muted-foreground">We&apos;ve got answers</p>
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
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
