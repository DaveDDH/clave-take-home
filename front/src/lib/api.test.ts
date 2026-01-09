import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  fetchConversations,
  fetchConversation,
  streamChatResponse,
  type StreamHandlers,
} from './api';

// Mock fetch globally
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch as typeof fetch;

describe('api', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('fetchConversations', () => {
    it('fetches conversations successfully', async () => {
      const mockConversations = [
        { id: '1', preview: 'test', created_at: '2024-01-01', updated_at: '2024-01-01', message_count: 1 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conversations: mockConversations }),
      } as Response);

      const result = await fetchConversations();
      expect(result).toEqual(mockConversations);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/conversations'));
    });

    it('throws error on failed fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      } as Response);

      await expect(fetchConversations()).rejects.toThrow('Failed to fetch conversations');
    });
  });

  describe('fetchConversation', () => {
    it('fetches single conversation successfully', async () => {
      const mockConversation = { id: '123', messages: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConversation,
      } as Response);

      const result = await fetchConversation('123');
      expect(result).toEqual(mockConversation);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/conversations/123'));
    });

    it('throws error on failed fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      } as Response);

      await expect(fetchConversation('123')).rejects.toThrow('Failed to fetch conversation');
    });
  });

  describe('streamChatResponse', () => {
    it('starts stream and returns cancel function', async () => {
      const mockCancel = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
      const mockRead = jest.fn<() => Promise<{ done: boolean; value?: Uint8Array }>>()
        .mockResolvedValueOnce({ done: true });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: mockRead,
            cancel: mockCancel,
          }),
        },
      } as unknown as Response);

      const handlers: StreamHandlers = {
        onComplete: jest.fn(),
      };

      const cancel = await streamChatResponse('test', null, 'gpt-5.2', {}, handlers);
      expect(typeof cancel).toBe('function');

      // Wait for stream to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(handlers.onComplete).toHaveBeenCalled();
    });

    it('throws error on failed stream start', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(
        streamChatResponse('test', null, 'gpt-5.2', {}, {})
      ).rejects.toThrow('Failed to start stream');
    });

    it('parses SSE events correctly', async () => {
      const encoder = new TextEncoder();
      const events = [
        'event: classification\ndata: {"isDataQuery":true,"chartType":"bar","conversationalResponse":"test"}',
        'event: progress\ndata: {"message":"Processing","step":"sql"}',
        'event: sql\ndata: {"sql":"SELECT * FROM table"}',
        'event: chart\ndata: {"charts":[{"type":"bar","data":[]}]}',
        'event: content-delta\ndata: {"token":"Hello"}',
        'event: content\ndata: {"content":"Full content"}',
        'event: conversationId\ndata: {"id":"conv-123"}',
        'event: cost\ndata: {"totalCost":0.05}',
        'event: complete\ndata: {}',
      ];

      let callIndex = 0;
      const mockRead = jest.fn<() => Promise<{ done: boolean; value?: Uint8Array }>>()
        .mockImplementation(async () => {
          if (callIndex < events.length) {
            const event = events[callIndex++];
            return { done: false, value: encoder.encode(event + '\n\n') };
          }
          return { done: true };
        });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: mockRead,
            cancel: jest.fn(),
          }),
        },
      } as unknown as Response);

      const handlers: StreamHandlers = {
        onClassification: jest.fn(),
        onProgress: jest.fn(),
        onSQL: jest.fn(),
        onChart: jest.fn(),
        onContentDelta: jest.fn(),
        onContent: jest.fn(),
        onConversationId: jest.fn(),
        onCost: jest.fn(),
        onComplete: jest.fn(),
      };

      await streamChatResponse('test', 'conv-1', 'gpt-5.2', { useConsistency: true }, handlers);

      // Wait for async stream processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handlers.onClassification).toHaveBeenCalledWith({
        isDataQuery: true,
        chartType: 'bar',
        conversationalResponse: 'test',
      });
      expect(handlers.onProgress).toHaveBeenCalledWith('Processing', 'sql');
      expect(handlers.onSQL).toHaveBeenCalledWith('SELECT * FROM table');
      expect(handlers.onChart).toHaveBeenCalledWith([{ type: 'bar', data: [] }]);
      expect(handlers.onContentDelta).toHaveBeenCalledWith('Hello');
      expect(handlers.onContent).toHaveBeenCalledWith('Full content');
      expect(handlers.onConversationId).toHaveBeenCalledWith('conv-123');
      expect(handlers.onCost).toHaveBeenCalledWith(0.05);
      expect(handlers.onComplete).toHaveBeenCalled();
    });

    it('handles error events', async () => {
      const encoder = new TextEncoder();
      const mockRead = jest.fn<() => Promise<{ done: boolean; value?: Uint8Array }>>()
        .mockResolvedValueOnce({
          done: false,
          value: encoder.encode('event: error\ndata: {"error":"Something went wrong"}\n\n'),
        })
        .mockResolvedValueOnce({ done: true });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: mockRead,
            cancel: jest.fn(),
          }),
        },
      } as unknown as Response);

      const handlers: StreamHandlers = {
        onError: jest.fn(),
        onComplete: jest.fn(),
      };

      await streamChatResponse('test', null, 'gpt-5.2', {}, handlers);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handlers.onError).toHaveBeenCalledWith('Something went wrong');
    });

    it('handles stream read errors', async () => {
      const mockRead = jest.fn<() => Promise<{ done: boolean; value?: Uint8Array }>>()
        .mockRejectedValueOnce(new Error('Network error'));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: mockRead,
            cancel: jest.fn(),
          }),
        },
      } as unknown as Response);

      const handlers: StreamHandlers = {
        onError: jest.fn(),
      };

      await streamChatResponse('test', null, 'gpt-5.2', {}, handlers);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handlers.onError).toHaveBeenCalledWith('Network error');
    });

    it('ignores malformed SSE lines', async () => {
      const encoder = new TextEncoder();
      const mockRead = jest.fn<() => Promise<{ done: boolean; value?: Uint8Array }>>()
        .mockResolvedValueOnce({
          done: false,
          value: encoder.encode(': comment line\n\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: encoder.encode('malformed line without event\n\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: encoder.encode('event: test\ndata: invalid json\n\n'),
        })
        .mockResolvedValueOnce({ done: true });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: mockRead,
            cancel: jest.fn(),
          }),
        },
      } as unknown as Response);

      const handlers: StreamHandlers = {
        onComplete: jest.fn(),
      };

      await streamChatResponse('test', null, 'gpt-5.2', {}, handlers);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should complete without throwing
      expect(handlers.onComplete).toHaveBeenCalled();
    });

    it('handles unknown event types', async () => {
      const encoder = new TextEncoder();
      const mockRead = jest.fn<() => Promise<{ done: boolean; value?: Uint8Array }>>()
        .mockResolvedValueOnce({
          done: false,
          value: encoder.encode('event: unknown_event\ndata: {"foo":"bar"}\n\n'),
        })
        .mockResolvedValueOnce({ done: true });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: mockRead,
            cancel: jest.fn(),
          }),
        },
      } as unknown as Response);

      const handlers: StreamHandlers = {
        onComplete: jest.fn(),
      };

      await streamChatResponse('test', null, 'gpt-5.2', {}, handlers);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handlers.onComplete).toHaveBeenCalled();
    });
  });
});
