import { create } from 'zustand';
import type { Message } from '@/types/chat';
import { streamChatResponse, fetchConversation, ModelId, ReasoningLevel } from '@/lib/api';

const DEFAULT_MODEL: ModelId = 'gpt-5.2';
const DEFAULT_REASONING: ReasoningLevel = 'high';

interface ChatState {
  conversationId: string | null;
  pendingConversation: { tempId: string; preview: string } | null;
  messages: Message[];
  isLoading: boolean;
  selectedModel: ModelId;
  reasoningLevel: ReasoningLevel;
  setSelectedModel: (model: ModelId) => void;
  setReasoningLevel: (level: ReasoningLevel) => void;
  sendMessage: (content: string) => Promise<void>;
  regenerateFrom: (messageId: string) => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;
  clearMessages: () => void;
  markTypewriterComplete: (messageId: string) => void;
}

type SetState = (
  updater: (state: ChatState) => Partial<ChatState>
) => void;

async function processStreamingMessage(
  message: string,
  conversationId: string | null,
  model: ModelId,
  reasoningLevel: ReasoningLevel,
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
      message,
      conversationId,
      model,
      { useConsistency: true, debug: false, reasoningLevel },
      {
        onClassification: (data) => {
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
            messages: [...state.messages, chartMessage],
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
          const targetId = secondMessageId || assistantMessageId;
          set((state) => ({
            messages: state.messages.map((msg) => {
              if (msg.id === targetId) {
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
              msg.id === targetId ? { ...msg, content } : msg
            ),
          }));
        },
        onConversationId: (id) => {
          set(() => ({ conversationId: id, pendingConversation: null }));
        },
        onCost: (totalCost) => {
          // Attach cost to the most recent assistant message
          const targetId = secondMessageId || assistantMessageId;
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === targetId ? { ...msg, cost: totalCost } : msg
            ),
          }));
        },
        onComplete: () => {
          receivedComplete = true;
          clearTimeout(timeout);
          set(() => ({ isLoading: false }));
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
    const targetId = secondMessageId ?? assistantMessageId;
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
  conversationId: null,
  pendingConversation: null,
  messages: [],
  isLoading: false,
  selectedModel: DEFAULT_MODEL,
  reasoningLevel: DEFAULT_REASONING,

  setSelectedModel: (model: ModelId) => set({ selectedModel: model }),
  setReasoningLevel: (level: ReasoningLevel) => set({ reasoningLevel: level }),

  sendMessage: async (content: string) => {
    if (!content.trim() || get().isLoading) return;

    const trimmedContent = content.trim();
    const currentConversationId = get().conversationId;
    const model = get().selectedModel;
    const reasoningLevel = get().reasoningLevel;

    // Create pending conversation optimistically if this is a new conversation
    const pendingConversation = currentConversationId
      ? null
      : { tempId: crypto.randomUUID(), preview: trimmedContent.slice(0, 50) };

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmedContent,
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
      pendingConversation: pendingConversation || state.pendingConversation,
    }));

    await processStreamingMessage(
      trimmedContent,
      currentConversationId,
      model,
      reasoningLevel,
      assistantId,
      set
    );
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
    const userMessage = messages[lastUserMessageIndex];
    const model = get().selectedModel;
    const reasoningLevel = get().reasoningLevel;

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

    await processStreamingMessage(
      userMessage.content,
      get().conversationId,
      model,
      reasoningLevel,
      assistantId,
      set
    );
  },

  loadConversation: async (id: string) => {
    try {
      set({ isLoading: true, messages: [], conversationId: id });
      const conversation = await fetchConversation(id);

      // Convert API messages to UI messages
      const uiMessages: Message[] = conversation.messages.map((msg) => ({
        id: crypto.randomUUID(),
        role: msg.role,
        content: msg.content,
        charts: msg.charts || undefined,
        isStreaming: false,
      }));

      set({ messages: uiMessages, isLoading: false });
    } catch (error) {
      console.error('Failed to load conversation:', error);
      set({ isLoading: false, conversationId: null });
    }
  },

  startNewConversation: () => {
    set({ conversationId: null, pendingConversation: null, messages: [], isLoading: false });
  },

  clearMessages: () => set({ messages: [], conversationId: null, pendingConversation: null }),

  markTypewriterComplete: (messageId: string) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, isStreaming: false } : msg
      ),
    }));
  },
}));
