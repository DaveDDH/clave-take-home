import { create } from 'zustand';
import type { Message } from '@/types/chat';
import { startChatProcess, pollProcessStatus, type ApiMessage } from '@/lib/api';

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  sendMessage: async (content: string) => {
    if (!content.trim() || get().isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
    }));

    try {
      // Convert messages to API format
      const apiMessages: ApiMessage[] = [...get().messages, userMessage].map(
        (msg) => ({
          role: msg.role,
          content: msg.content,
        })
      );

      // Start the async process
      const processId = await startChatProcess(apiMessages, {
        useConsistency: true,
        debug: false,
      });

      // Poll for results
      const result = await pollProcessStatus(processId);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.content,
        charts: result.charts,
        sql: result.sql,
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to send message:', error);

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        error:
          error instanceof Error
            ? error.message
            : 'An unknown error occurred',
      };

      set((state) => ({
        messages: [...state.messages, errorMessage],
        isLoading: false,
      }));
    }
  },
  clearMessages: () => set({ messages: [] }),
}));
