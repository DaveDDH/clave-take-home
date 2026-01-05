import { create } from 'zustand';
import type { Message } from '@/types/chat';
import {
  startChatProcess,
  getProcessStatus,
  type ApiMessage,
} from '@/lib/api';

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

      let hasPartialResponse = false;

      // Poll for results with partial response support
      let attempts = 0;
      const maxAttempts = 120;
      const intervalMs = 1000;

      while (attempts < maxAttempts) {
        const status = await getProcessStatus(processId);

        // Show partial response as soon as available
        if (
          status.partialResponse &&
          !hasPartialResponse &&
          status.status === 'processing'
        ) {
          hasPartialResponse = true;
          const partialMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: status.partialResponse,
          };

          set((state) => ({
            messages: [...state.messages, partialMessage],
          }));
        }

        // Final result ready
        if (status.status === 'completed' && status.result) {
          const finalMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: status.result.content,
            charts: status.result.charts,
            sql: status.result.sql,
          };

          // Add final message (don't replace partial)
          set((state) => ({
            messages: [...state.messages, finalMessage],
            isLoading: false,
          }));
          return;
        }

        // Process failed
        if (status.status === 'failed') {
          throw new Error(status.error || 'Process failed');
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        attempts++;
      }

      throw new Error('Process polling timeout');
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
