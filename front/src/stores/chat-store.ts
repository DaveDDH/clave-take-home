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
          console.log('[SSE] Classification received:', data.conversationalResponse.substring(0, 50));
          // Update first message with classification
          // Keep isStreaming true in case this is a data query (charts will arrive later)
          // If it's conversational, onComplete will mark it as not streaming
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: data.conversationalResponse }
                : msg
            ),
          }));
        },
        onChart: (charts) => {
          console.log('[SSE] Charts received:', charts.length, 'chart(s)');
          // Create a NEW message for charts + final response
          secondMessageId = crypto.randomUUID();
          const chartMessage: Message = {
            id: secondMessageId,
            role: 'assistant',
            content: '',
            charts,
            isStreaming: true,
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
          console.log('[SSE] SQL received');
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
          set((state) => {
            const updatedMessages = state.messages.map((msg) => {
              if (msg.id === targetId) {
                const newContent = msg.content + token;
                console.log('[TYPEWRITER] Appending token to message:', {
                  messageId: msg.id,
                  isFirstMessage: msg.id === assistantMessageId,
                  isSecondMessage: msg.id === secondMessageId,
                  isStreaming: msg.isStreaming,
                  oldContentLength: msg.content.length,
                  newContentLength: newContent.length,
                  hasCharts: !!msg.charts,
                });
                return { ...msg, content: newContent };
              }
              return msg;
            });
            return { messages: updatedMessages };
          });
        },
        onContent: (content) => {
          console.log('[SSE] Full content received:', content.substring(0, 50));
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
          console.log('[SSE] Stream complete');
          receivedComplete = true;
          clearTimeout(timeout);
          set((state) => {
            const finalMessage = state.messages.find(msg =>
              msg.id === (secondMessageId || assistantMessageId)
            );
            console.log('[SSE] Final message:', finalMessage);
            return {
              messages: state.messages.map((msg) => {
                // Mark both first and second messages as not streaming
                if (msg.id === assistantMessageId || msg.id === secondMessageId) {
                  return { ...msg, isStreaming: false };
                }
                return msg;
              }),
              isLoading: false,
            };
          });
        },
        onError: (error) => {
          console.error('[SSE] Error:', error);
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
