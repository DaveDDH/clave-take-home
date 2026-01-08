"use client";

import { useState, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useChatStore } from "@/stores/chat-store";
import type { ModelId } from "@/lib/api";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const MODELS: { id: ModelId; name: string; description: string }[] = [
  { id: "gpt-5.2", name: "GPT 5.2", description: "Powerful, for complex queries" },
  { id: "grok-4.1-fast", name: "Grok 4.1 Fast", description: "Fast and efficient" },
  { id: "gpt-oss-20b", name: "GPT-OSS 20B", description: "Open source alternative" },
];

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const selectedModelId = useChatStore((state) => state.selectedModel);
  const setSelectedModel = useChatStore((state) => state.setSelectedModel);
  const selectedModel = MODELS.find((m) => m.id === selectedModelId) || MODELS[0];

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
              <Select
                value={selectedModelId}
                onValueChange={(value) => setSelectedModel(value as ModelId)}
              >
                <SelectTrigger
                  size="sm"
                  className="border-0 bg-transparent shadow-none text-muted-foreground hover:text-foreground"
                >
                  <span>{selectedModel.name}</span>
                </SelectTrigger>
                <SelectContent position="popper" align="end" side="top" sideOffset={4}>
                  {MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id} className="py-2">
                      <div className="flex flex-col items-start">
                        <span>{model.name}</span>
                        <span className="text-xs text-muted-foreground">{model.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex h-8 items-center gap-2 px-3 text-sm text-muted-foreground">
                {selectedModel.name}
                <ChevronDown className="size-4 opacity-50" />
              </div>
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
