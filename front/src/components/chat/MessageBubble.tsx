"use client";

import { useState, useMemo } from "react";
import type { Message, ChartData } from "@/types/chat";
import type { WidgetChart } from "@/types/widget";
import { ChartMessage } from "./ChartMessage";
import { SaveWidgetModal } from "./SaveWidgetModal";
import { useChatStore } from "@/stores/chat-store";
import { Copy, RotateCw, Save } from "lucide-react";
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
        {message.content && (
          <div className="max-w-[80%] rounded-2xl px-4 py-3 pt-0">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
            </div>
          </div>
        )}
        <ChartMessage charts={message.charts} />
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
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className={`flex  ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
            isUser ? "bg-primary text-primary-foreground" : ""
          }`}
        >
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
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
    </div>
  );
}
