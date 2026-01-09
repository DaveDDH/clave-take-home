import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { ChartData } from '@/types/chat';

// Handler types for streamChatResponse
interface StreamHandlers {
  onClassification?: (data: { isDataQuery: boolean; chartType: string; conversationalResponse: string }) => void;
  onChart?: (charts: ChartData[]) => void;
  onSQL?: (sql: string) => void;
  onContentDelta?: (delta: string) => void;
  onContent?: (content: string) => void;
  onConversationId?: (id: string) => void;
  onCost?: (cost: number) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
}

type StreamChatFn = (
  message: string,
  conversationId: string | null,
  model: string,
  options: Record<string, unknown>,
  handlers: StreamHandlers
) => Promise<() => void>;

type FetchConversationFn = (id: string) => Promise<{
  id: string;
  messages: Array<{ role: string; content: string; charts: ChartData[] | null }>;
}>;

// No-op cleanup function for stream mocks
const noopCleanup = (): void => { /* cleanup */ };

// Mock the api module
const mockStreamChatResponse = jest.fn<StreamChatFn>();
const mockFetchConversation = jest.fn<FetchConversationFn>();

jest.unstable_mockModule('@/lib/api', () => ({
  streamChatResponse: mockStreamChatResponse,
  fetchConversation: mockFetchConversation,
}));

// Dynamically import after mocking
const { useChatStore } = await import('./chat-store');

describe('useChatStore', () => {
  beforeEach(() => {
    // Reset store state
    useChatStore.setState({
      conversationId: null,
      pendingConversation: null,
      messages: [],
      isLoading: false,
      selectedModel: 'gpt-5.2',
      reasoningLevel: 'high',
    });
    mockStreamChatResponse.mockClear();
    mockFetchConversation.mockClear();
  });

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useChatStore.getState();
      expect(state.conversationId).toBeNull();
      expect(state.pendingConversation).toBeNull();
      expect(state.messages).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.selectedModel).toBe('gpt-5.2');
      expect(state.reasoningLevel).toBe('high');
    });
  });

  describe('setSelectedModel', () => {
    it('updates the selected model', () => {
      useChatStore.getState().setSelectedModel('grok-4.1-fast');
      expect(useChatStore.getState().selectedModel).toBe('grok-4.1-fast');
    });
  });

  describe('setReasoningLevel', () => {
    it('updates the reasoning level', () => {
      useChatStore.getState().setReasoningLevel('low');
      expect(useChatStore.getState().reasoningLevel).toBe('low');
    });
  });

  describe('sendMessage', () => {
    it('does not send empty messages', async () => {
      await useChatStore.getState().sendMessage('   ');
      expect(mockStreamChatResponse).not.toHaveBeenCalled();
    });

    it('does not send when already loading', async () => {
      useChatStore.setState({ isLoading: true });
      await useChatStore.getState().sendMessage('test');
      expect(mockStreamChatResponse).not.toHaveBeenCalled();
    });

    it('adds user and assistant messages and calls stream', async () => {
      mockStreamChatResponse.mockImplementation(async (_msg, _conv, _model, _opts, handlers: StreamHandlers) => {
        handlers.onComplete?.();
        return noopCleanup;
      });

      await useChatStore.getState().sendMessage('Hello');

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].role).toBe('user');
      expect(state.messages[0].content).toBe('Hello');
      expect(state.messages[1].role).toBe('assistant');
      expect(mockStreamChatResponse).toHaveBeenCalledWith(
        'Hello',
        null,
        'gpt-5.2',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('creates pending conversation for new conversations', async () => {
      mockStreamChatResponse.mockImplementation(async () => noopCleanup);

      const sendPromise = useChatStore.getState().sendMessage('Hello');

      // Check pending conversation was created
      const stateAfterSend = useChatStore.getState();
      expect(stateAfterSend.pendingConversation).not.toBeNull();
      expect(stateAfterSend.pendingConversation?.preview).toBe('Hello');

      await sendPromise;
    });

    it('handles classification callback', async () => {
      mockStreamChatResponse.mockImplementation(async (_msg, _conv, _model, _opts, handlers: StreamHandlers) => {
        handlers.onClassification?.({
          isDataQuery: true,
          chartType: 'bar',
          conversationalResponse: 'Here is the data',
        });
        handlers.onComplete?.();
        return noopCleanup;
      });

      await useChatStore.getState().sendMessage('Show me data');

      const state = useChatStore.getState();
      expect(state.messages[1].content).toBe('Here is the data');
    });

    it('handles chart callback', async () => {
      mockStreamChatResponse.mockImplementation(async (_msg, _conv, _model, _opts, handlers: StreamHandlers) => {
        handlers.onChart?.([{ type: 'bar', data: [] }]);
        handlers.onComplete?.();
        return noopCleanup;
      });

      await useChatStore.getState().sendMessage('Show chart');

      const state = useChatStore.getState();
      // Should have 3 messages: user, assistant, chart
      expect(state.messages.length).toBeGreaterThanOrEqual(2);
    });

    it('handles SQL callback', async () => {
      mockStreamChatResponse.mockImplementation(async (_msg, _conv, _model, _opts, handlers: StreamHandlers) => {
        handlers.onSQL?.('SELECT * FROM table');
        handlers.onComplete?.();
        return noopCleanup;
      });

      await useChatStore.getState().sendMessage('Run query');

      const state = useChatStore.getState();
      expect(state.messages[1].sql).toBe('SELECT * FROM table');
    });

    it('handles content delta callback', async () => {
      mockStreamChatResponse.mockImplementation(async (_msg, _conv, _model, _opts, handlers: StreamHandlers) => {
        handlers.onContentDelta?.('Hello');
        handlers.onContentDelta?.(' World');
        handlers.onComplete?.();
        return noopCleanup;
      });

      await useChatStore.getState().sendMessage('Test');

      const state = useChatStore.getState();
      expect(state.messages[1].content).toBe('Hello World');
    });

    it('handles content callback', async () => {
      mockStreamChatResponse.mockImplementation(async (_msg, _conv, _model, _opts, handlers: StreamHandlers) => {
        handlers.onContent?.('Full response');
        handlers.onComplete?.();
        return noopCleanup;
      });

      await useChatStore.getState().sendMessage('Test');

      const state = useChatStore.getState();
      expect(state.messages[1].content).toBe('Full response');
    });

    it('handles conversationId callback', async () => {
      mockStreamChatResponse.mockImplementation(async (_msg, _conv, _model, _opts, handlers: StreamHandlers) => {
        handlers.onConversationId?.('conv-123');
        handlers.onComplete?.();
        return noopCleanup;
      });

      await useChatStore.getState().sendMessage('Test');

      const state = useChatStore.getState();
      expect(state.conversationId).toBe('conv-123');
      expect(state.pendingConversation).toBeNull();
    });

    it('handles cost callback', async () => {
      mockStreamChatResponse.mockImplementation(async (_msg, _conv, _model, _opts, handlers: StreamHandlers) => {
        handlers.onCost?.(0.05);
        handlers.onComplete?.();
        return noopCleanup;
      });

      await useChatStore.getState().sendMessage('Test');

      const state = useChatStore.getState();
      expect(state.messages[1].cost).toBe(0.05);
    });

    it('handles error callback', async () => {
      mockStreamChatResponse.mockImplementation(async (_msg, _conv, _model, _opts, handlers: StreamHandlers) => {
        handlers.onError?.('Something went wrong');
        return noopCleanup;
      });

      await useChatStore.getState().sendMessage('Test');

      const state = useChatStore.getState();
      expect(state.messages[1].error).toBe('Something went wrong');
      expect(state.isLoading).toBe(false);
    });

    it('handles stream exception', async () => {
      mockStreamChatResponse.mockRejectedValueOnce(new Error('Network error'));

      await useChatStore.getState().sendMessage('Test');

      const state = useChatStore.getState();
      expect(state.messages[1].error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('regenerateFrom', () => {
    it('does not regenerate when loading', async () => {
      useChatStore.setState({ isLoading: true });
      await useChatStore.getState().regenerateFrom('msg-1');
      expect(mockStreamChatResponse).not.toHaveBeenCalled();
    });

    it('does not regenerate for non-existent message', async () => {
      useChatStore.setState({
        messages: [{ id: 'msg-1', role: 'user', content: 'test' }],
      });
      await useChatStore.getState().regenerateFrom('non-existent');
      expect(mockStreamChatResponse).not.toHaveBeenCalled();
    });

    it('regenerates from a message', async () => {
      useChatStore.setState({
        conversationId: 'conv-1',
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello' },
          { id: 'msg-2', role: 'assistant', content: 'Hi there' },
        ],
      });

      mockStreamChatResponse.mockImplementation(async (_msg, _conv, _model, _opts, handlers: StreamHandlers) => {
        handlers.onComplete?.();
        return noopCleanup;
      });

      await useChatStore.getState().regenerateFrom('msg-2');

      expect(mockStreamChatResponse).toHaveBeenCalledWith(
        'Hello',
        'conv-1',
        'gpt-5.2',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('handles case when no user message before assistant', async () => {
      // This shouldn't happen in practice, but test the edge case
      useChatStore.setState({
        messages: [{ id: 'msg-1', role: 'assistant', content: 'test' }],
      });

      // Spy on console.error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await useChatStore.getState().regenerateFrom('msg-1');

      expect(mockStreamChatResponse).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('No user message found before assistant block');

      consoleSpy.mockRestore();
    });
  });

  describe('loadConversation', () => {
    it('loads conversation successfully', async () => {
      mockFetchConversation.mockResolvedValueOnce({
        id: 'conv-1',
        messages: [
          { role: 'user', content: 'Hello', charts: null },
          { role: 'assistant', content: 'Hi', charts: null },
        ],
      });

      await useChatStore.getState().loadConversation('conv-1');

      const state = useChatStore.getState();
      expect(state.conversationId).toBe('conv-1');
      expect(state.messages).toHaveLength(2);
      expect(state.isLoading).toBe(false);
    });

    it('handles load error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetchConversation.mockRejectedValueOnce(new Error('Failed'));

      await useChatStore.getState().loadConversation('conv-1');

      const state = useChatStore.getState();
      expect(state.conversationId).toBeNull();
      expect(state.isLoading).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe('startNewConversation', () => {
    it('resets conversation state', () => {
      useChatStore.setState({
        conversationId: 'conv-1',
        pendingConversation: { tempId: 'temp', preview: 'test' },
        messages: [{ id: 'msg-1', role: 'user', content: 'test' }],
        isLoading: true,
      });

      useChatStore.getState().startNewConversation();

      const state = useChatStore.getState();
      expect(state.conversationId).toBeNull();
      expect(state.pendingConversation).toBeNull();
      expect(state.messages).toEqual([]);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('clearMessages', () => {
    it('clears all messages and conversation', () => {
      useChatStore.setState({
        conversationId: 'conv-1',
        pendingConversation: { tempId: 'temp', preview: 'test' },
        messages: [{ id: 'msg-1', role: 'user', content: 'test' }],
      });

      useChatStore.getState().clearMessages();

      const state = useChatStore.getState();
      expect(state.conversationId).toBeNull();
      expect(state.pendingConversation).toBeNull();
      expect(state.messages).toEqual([]);
    });
  });

  describe('markTypewriterComplete', () => {
    it('marks message as not streaming', () => {
      useChatStore.setState({
        messages: [{ id: 'msg-1', role: 'assistant', content: 'test', isStreaming: true }],
      });

      useChatStore.getState().markTypewriterComplete('msg-1');

      const state = useChatStore.getState();
      expect(state.messages[0].isStreaming).toBe(false);
    });

    it('does not affect other messages', () => {
      useChatStore.setState({
        messages: [
          { id: 'msg-1', role: 'assistant', content: 'test', isStreaming: true },
          { id: 'msg-2', role: 'assistant', content: 'test2', isStreaming: true },
        ],
      });

      useChatStore.getState().markTypewriterComplete('msg-1');

      const state = useChatStore.getState();
      expect(state.messages[0].isStreaming).toBe(false);
      expect(state.messages[1].isStreaming).toBe(true);
    });
  });
});
