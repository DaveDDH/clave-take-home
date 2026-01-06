"use client";

import { useState, useMemo } from "react";
import type { Message, ChartData } from "@/types/chat";
import type { WidgetChart } from "@/types/widget";
import { ChartMessage } from "./ChartMessage";
import { SaveWidgetModal } from "./SaveWidgetModal";
import { useChatStore } from "@/stores/chat-store";
import { useTypewriter } from "@/hooks/useTypewriter";
import { Copy, RotateCw, Save, Brain } from "lucide-react";
import { Button } from "../ui/button";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageBubbleProps {
  message: Message;
  isLastInBlock?: boolean;
  hasChartsInBlock?: boolean;
  blockCharts?: ChartData[];
  blockContent?: string;
  isLoading?: boolean;
}

export function MessageBubble({
  message,
  isLastInBlock = false,
  hasChartsInBlock = false,
  blockCharts = [],
  blockContent = '',
  isLoading = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Use typewriter effect for assistant messages that are streaming
  const typewriterEnabled = !isUser && message.isStreaming === true;
  console.log('[TYPEWRITER] MessageBubble render:', {
    messageId: message.id,
    isUser,
    isStreaming: message.isStreaming,
    typewriterEnabled,
    contentLength: message.content.length,
    hasCharts: !!message.charts,
  });

  const displayedContent = useTypewriter({
    text: message.content,
    enabled: typewriterEnabled,
    speed: 50, // 50 characters per second
  });
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const regenerateFrom = useChatStore((state) => state.regenerateFrom);

  const widgetCharts = useMemo<WidgetChart[]>(() => {
    return blockCharts.map((chart) => ({
      type: chart.type,
      data: chart.data as never,
      config: chart.config,
    }));
  }, [blockCharts]);

  const onCopyClick = async () => {
    try {
      const contentToCopy = blockContent || message.content;
      await navigator.clipboard.writeText(contentToCopy);
      console.log("Message copied to clipboard");
    } catch (error) {
      console.error("Failed to copy message:", error);
    }
  };

  const onRegenerateClick = () => {
    regenerateFrom(message.id);
  };

  const onSaveClick = () => {
    setSaveModalOpen(true);
  };

  const chatQuickAction = (
    IconComponent: React.FC<{ className: string }>,
    onClick: () => void
  ) => {
    return (
      <Button onClick={onClick} variant="ghost">
        <IconComponent className="text-gray-400" />
      </Button>
    );
  };

  if (message.charts?.length) {
    return (
      <div className="flex flex-col gap-2 justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
        <ChartMessage charts={message.charts} />
        {displayedContent && (
          <div className="max-w-[80%] rounded-2xl px-4 py-3 pt-0">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              <Markdown remarkPlugins={[remarkGfm]}>{displayedContent}</Markdown>
            </div>
          </div>
        )}
        {!isUser && isLastInBlock && !isLoading && (
          <div className="flex items-center gap-1 pl-4">
            {chatQuickAction(Copy, onCopyClick)}
            {chatQuickAction(RotateCw, onRegenerateClick)}
            {hasChartsInBlock && chatQuickAction(Save, onSaveClick)}
          </div>
        )}
        <SaveWidgetModal
          open={saveModalOpen}
          onOpenChange={setSaveModalOpen}
          charts={widgetCharts}
        />
        {!isUser && !isLastInBlock && (
          <div className="flex items-center gap-1.5 justify-start pl-4 mt-2">
            <Brain className="size-3.5 text-foreground" />
            <span className="text-sm text-foreground font-bold italic">
              Reasoning...
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className={`flex  ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
            isUser ? "bg-muted text-foreground" : ""
          }`}
        >
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            <Markdown remarkPlugins={[remarkGfm]}>{displayedContent}</Markdown>
          </div>
        </div>
      </div>
      {!isUser && isLastInBlock && !isLoading && (
        <div className="flex items-center gap-0 pl-4">
          {chatQuickAction(Copy, onCopyClick)}
          {chatQuickAction(RotateCw, onRegenerateClick)}
          {hasChartsInBlock && chatQuickAction(Save, onSaveClick)}
        </div>
      )}
      <SaveWidgetModal
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        charts={widgetCharts}
      />
      {!isUser && !isLastInBlock && (
        <div className="flex items-center gap-1.5 justify-start pl-4 mt-2">
          <Brain className="size-3.5 text-foreground" />
          <span className="text-sm text-foreground font-bold italic">
            Reasoning...
          </span>
        </div>
      )}
    </div>
  );
}
