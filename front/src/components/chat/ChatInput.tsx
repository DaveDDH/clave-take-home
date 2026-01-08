"use client";

import { useState, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useChatStore } from "@/stores/chat-store";
import type { ModelId } from "@/lib/api";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const MODELS: { id: ModelId; name: string }[] = [
  { id: "grok-4.1-fast", name: "Grok 4.1 Fast" },
  { id: "gpt-5.2", name: "GPT 5.2" },
  { id: "gpt-oss-20b", name: "GPT-OSS 20B" },
];

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const selectedModelId = useChatStore((state) => state.selectedModel);
  const setSelectedModel = useChatStore((state) => state.setSelectedModel);
  const selectedModel = MODELS.find((m) => m.id === selectedModelId) || MODELS[0];
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const canSubmit = input.trim() && !disabled;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    onSend(input);
    setInput("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  return (
    <div className="p-4 pb-3">
      <form onSubmit={handleSubmit} className="mx-auto max-w-5xl">
        <div className="flex items-end gap-2 rounded-2xl bg-muted px-4 py-3">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask something..."
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none border-0 bg-transparent dark:bg-transparent p-0 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none rounded-none"
          />
          <div className="flex items-center gap-2">
            {mounted ? (
              <Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {selectedModel.name}
                    <ChevronDown className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="end">
                  <div className="flex flex-col gap-1">
                    {MODELS.map((model) => (
                      <Button
                        key={model.id}
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => {
                          setSelectedModel(model.id);
                          setModelPopoverOpen(false);
                        }}
                      >
                        {model.name}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-sm text-muted-foreground"
                disabled
              >
                {selectedModel.name}
                <ChevronDown className="size-4" />
              </Button>
            )}
            <Button
              type="submit"
              size="icon"
              disabled={!canSubmit}
              className="size-9 rounded-xl"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </div>
      </form>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Clave is AI and can make mistakes. Please verify responses.
      </p>
    </div>
  );
}
