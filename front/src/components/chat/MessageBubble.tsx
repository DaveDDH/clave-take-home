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
  nextMessage?: Message;
}

export function MessageBubble({
  message,
  isLastInBlock = false,
  hasChartsInBlock = false,
  blockCharts = [],
  blockContent = "",
  isLoading = false,
  nextMessage,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Use typewriter effect for assistant messages that are streaming
  const typewriterEnabled = !isUser && message.isStreaming === true;

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const regenerateFrom = useChatStore((state) => state.regenerateFrom);

  const displayedContent = useTypewriter({
    text: message.content,
    enabled: typewriterEnabled,
    speed: 50, // 50 characters per second
  });

  const widgetCharts = useMemo<WidgetChart[]>(() => {
    return blockCharts.map((chart) => ({
      type: chart.type,
      data: chart.data as never,
      config: chart.config,
    }));
  }, [blockCharts]);

  // Calculate reasoning text
  const reasoningText = useMemo(() => {
    console.log("[MESSAGE-BUBBLE] Calculating reasoningText", {
      messageId: message.id,
      hasNextMessage: !!nextMessage,
      isLoading,
      nextMessageIsStreaming: nextMessage?.isStreaming,
      messagePartialTimestamp: message.partialTimestamp,
      nextMessageFinalTimestamp: nextMessage?.finalTimestamp,
      isLastInBlock,
    });

    if (!nextMessage) {
      console.log("[MESSAGE-BUBBLE] No next message, returning null");
      return null;
    }

    // Show "Reasoning..." if still loading or next message is streaming
    if (isLoading || nextMessage.isStreaming) {
      console.log('[MESSAGE-BUBBLE] Returning "Reasoning..." because', {
        isLoading,
        nextMessageIsStreaming: nextMessage.isStreaming,
      });
      return "Reasoning...";
    }

    // Show "Thought for X seconds" if we have timestamps
    if (message.partialTimestamp && nextMessage.finalTimestamp) {
      const duration =
        (nextMessage.finalTimestamp - message.partialTimestamp) / 1000;
      console.log('[MESSAGE-BUBBLE] Returning "Thought for X seconds"', {
        duration,
        partialTimestamp: message.partialTimestamp,
        finalTimestamp: nextMessage.finalTimestamp,
      });
      return `Thought for ${duration.toFixed(1)} seconds`;
    }

    console.log("[MESSAGE-BUBBLE] No conditions met, returning null");
    return null;
  }, [
    isLoading,
    nextMessage,
    message.partialTimestamp,
    isLastInBlock,
    message.id,
  ]);

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

  // Log when rendering reasoning section
  if (!isUser && !isLastInBlock) {
    console.log("[MESSAGE-BUBBLE] Rendering decision for reasoning section", {
      messageId: message.id,
      isUser,
      isLastInBlock,
      reasoningText,
      willRender: !!reasoningText,
    });
  }

  if (message.charts?.length) {
    return (
      <div className="flex flex-col gap-2 justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
        <ChartMessage charts={message.charts} />
        {displayedContent && (
          <div className="max-w-[80%] rounded-2xl px-4 py-3 pt-0">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              <Markdown remarkPlugins={[remarkGfm]}>
                {displayedContent}
              </Markdown>
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
        {!isUser && !isLastInBlock && reasoningText && (
          <div className="flex items-center gap-1.5 justify-start pl-4 mt-2">
            <Brain className="size-3.5 text-foreground" />
            <span className="text-sm text-foreground font-bold italic">
              {reasoningText}
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
      {!isUser && !isLastInBlock && reasoningText && (
        <div className="flex items-center gap-1.5 justify-start pl-4 mt-2">
          <Brain className="size-3.5 text-foreground" />
          <span className="text-sm text-foreground font-bold italic">
            {reasoningText}
          </span>
        </div>
      )}
    </div>
  );
}
