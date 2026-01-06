import { create } from 'zustand';
import type { Message } from '@/types/chat';
import {
  streamChatResponse,
  type ApiMessage,
} from '@/lib/api';

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  sendMessage: (content: string) => Promise<void>;
  regenerateFrom: (messageId: string) => Promise<void>;
  clearMessages: () => void;
}

type SetState = (
  updater: (state: ChatState) => Partial<ChatState>
) => void;

async function processStreamingMessage(
  apiMessages: ApiMessage[],
  assistantMessageId: string,
  set: SetState
): Promise<void> {
  let receivedComplete = false;
  let secondMessageId: string | null = null;
  const timeout = setTimeout(() => {
    if (!receivedComplete) {
      const targetId = secondMessageId || assistantMessageId;
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === targetId
            ? {
                ...msg,
                error: 'Connection timeout',
                isStreaming: false,
              }
            : msg
        ),
        isLoading: false,
      }));
    }
  }, 120000); // 2 min timeout

  try {
    await streamChatResponse(
      apiMessages,
      { useConsistency: true, debug: false },
      {
        onClassification: (data) => {
          // Update first message with classification
          // Keep isStreaming true in case this is a data query (charts will arrive later)
          // If it's conversational, onComplete will mark it as not streaming
          const timestamp = Date.now();
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: data.conversationalResponse,
                    partialTimestamp: timestamp
                  }
                : msg
            ),
          }));
        },
        onChart: (charts) => {
          // Create a NEW message for charts + final response
          secondMessageId = crypto.randomUUID();
          const timestamp = Date.now();
          const chartMessage: Message = {
            id: secondMessageId,
            role: 'assistant',
            content: '',
            charts,
            isStreaming: true,
            finalTimestamp: timestamp,
          };
          set((state) => ({
            messages: [
              // Keep first message (let typewriter finish)
              ...state.messages,
              // Add second message with charts
              chartMessage,
            ],
          }));
        },
        onSQL: (sql) => {
          const targetId = secondMessageId || assistantMessageId;
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === targetId ? { ...msg, sql } : msg
            ),
          }));
        },
        onContentDelta: (token) => {
          // Stream into the second message (with charts) if it exists, otherwise first message
          const targetId = secondMessageId || assistantMessageId;
          set((state) => ({
            messages: state.messages.map((msg) => {
              if (msg.id === targetId) {
                // Set finalTimestamp on first content delta if not already set
                const updates: Partial<Message> = { content: msg.content + token };
                if (!msg.finalTimestamp && msg.partialTimestamp) {
                  updates.finalTimestamp = Date.now();
                }
                return { ...msg, ...updates };
              }
              return msg;
            }),
          }));
        },
        onContent: (content) => {
          const targetId = secondMessageId || assistantMessageId;
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === targetId
                ? { ...msg, content }
                : msg
            ),
          }));
        },
        onComplete: () => {
          receivedComplete = true;
          clearTimeout(timeout);
          // Only set isLoading: false - keep isStreaming: true for typewriter animation
          set(() => ({
            isLoading: false,
          }));
        },
        onError: (error) => {
          clearTimeout(timeout);
          const targetId = secondMessageId || assistantMessageId;
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === targetId
                ? { ...msg, error, isStreaming: false }
                : msg
            ),
            isLoading: false,
          }));
        },
      }
    );
  } catch (error) {
    clearTimeout(timeout);
    const targetId = secondMessageId || assistantMessageId;
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === targetId
          ? {
              ...msg,
              content: msg.content || 'Sorry, something went wrong.',
              error: error instanceof Error ? error.message : 'Unknown error',
              isStreaming: false,
            }
          : msg
      ),
      isLoading: false,
    }));
  }
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

    const assistantId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isLoading: true,
    }));

    const apiMessages: ApiMessage[] = [...get().messages, userMessage].map(
      (msg) => ({
        role: msg.role,
        content: msg.content,
      })
    );

    await processStreamingMessage(apiMessages, assistantId, set);
  },
  regenerateFrom: async (messageId: string) => {
    if (get().isLoading) return;

    const messages = get().messages;
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);

    if (messageIndex === -1) return;

    let lastUserMessageIndex = messageIndex;
    while (
      lastUserMessageIndex > 0 &&
      messages[lastUserMessageIndex].role !== 'user'
    ) {
      lastUserMessageIndex--;
    }

    if (messages[lastUserMessageIndex].role !== 'user') {
      console.error('No user message found before assistant block');
      return;
    }

    const messagesUpToUser = messages.slice(0, lastUserMessageIndex + 1);

    const assistantId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    set({
      messages: [...messagesUpToUser, assistantMessage],
      isLoading: true,
    });

    const apiMessages: ApiMessage[] = messagesUpToUser.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    await processStreamingMessage(apiMessages, assistantId, set);
  },
  clearMessages: () => set({ messages: [] }),
}));
