import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SSEWriter } from './sse.js';
import type { Response } from 'express';

describe('SSEWriter', () => {
  let mockRes: Response;
  let writtenData: string[];
  let headersSent: Record<string, string>;

  beforeEach(() => {
    writtenData = [];
    headersSent = {};
    mockRes = {
      setHeader: jest.fn((key: string, value: string) => {
        headersSent[key] = value;
        return mockRes;
      }),
      flushHeaders: jest.fn(),
      write: jest.fn((data: string) => {
        writtenData.push(data);
        return true;
      }),
      end: jest.fn(() => mockRes),
      writableEnded: false,
      socket: {
        setNoDelay: jest.fn(),
      },
      on: jest.fn((event: string, callback: () => void) => {
        if (event === 'close') {
          (mockRes as unknown as { closeCallback: () => void }).closeCallback = callback;
        }
        return mockRes;
      }),
    } as unknown as Response;

    // Mock setInterval to track keepAlive
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sets SSE headers on construction', () => {
    void new SSEWriter(mockRes);
    expect(headersSent['Content-Type']).toBe('text/event-stream');
    expect(headersSent['Cache-Control']).toBe('no-cache');
    expect(headersSent['Connection']).toBe('keep-alive');
    expect(headersSent['X-Accel-Buffering']).toBe('no');
  });

  it('flushes headers on construction', () => {
    void new SSEWriter(mockRes);
    expect(mockRes.flushHeaders).toHaveBeenCalled();
  });

  it('sets socket no delay', () => {
    void new SSEWriter(mockRes);
    expect(mockRes.socket?.setNoDelay).toHaveBeenCalledWith(true);
  });

  describe('sendEvent', () => {
    it('writes formatted SSE event', () => {
      const writer = new SSEWriter(mockRes);
      writer.sendEvent('test', { message: 'hello' });
      expect(writtenData).toHaveLength(1);
      expect(writtenData[0]).toBe('event: test\ndata: {"message":"hello"}\n\n');
    });

    it('does not write after close', () => {
      const writer = new SSEWriter(mockRes);
      writer.close();
      writer.sendEvent('test', { message: 'hello' });
      // Only keep-alive might have been written, but no test event
      const testEvents = writtenData.filter((d) => d.includes('event: test'));
      expect(testEvents).toHaveLength(0);
    });
  });

  describe('convenience methods', () => {
    it('sendStart sends start event', () => {
      const writer = new SSEWriter(mockRes);
      writer.sendStart();
      expect(writtenData.some((d) => d.includes('event: start'))).toBe(true);
    });

    it('sendClassification sends classification event', () => {
      const writer = new SSEWriter(mockRes);
      writer.sendClassification({
        isDataQuery: true,
        chartType: 'bar',
        conversationalResponse: 'Processing...',
      });
      expect(writtenData.some((d) => d.includes('event: classification'))).toBe(true);
    });

    it('sendProgress sends progress event', () => {
      const writer = new SSEWriter(mockRes);
      writer.sendProgress('Loading data', 'step1');
      expect(writtenData.some((d) => d.includes('event: progress'))).toBe(true);
    });

    it('sendSQL sends sql event', () => {
      const writer = new SSEWriter(mockRes);
      writer.sendSQL('SELECT * FROM orders');
      expect(writtenData.some((d) => d.includes('event: sql'))).toBe(true);
    });

    it('sendChart sends chart event', () => {
      const writer = new SSEWriter(mockRes);
      writer.sendChart([{ type: 'bar', data: [], config: {} }]);
      expect(writtenData.some((d) => d.includes('event: chart'))).toBe(true);
    });

    it('sendContentDelta sends content-delta event', () => {
      const writer = new SSEWriter(mockRes);
      writer.sendContentDelta('token');
      expect(writtenData.some((d) => d.includes('event: content-delta'))).toBe(true);
    });

    it('sendContent sends content event', () => {
      const writer = new SSEWriter(mockRes);
      writer.sendContent('Full content');
      expect(writtenData.some((d) => d.includes('event: content'))).toBe(true);
    });

    it('sendError sends error event', () => {
      const writer = new SSEWriter(mockRes);
      writer.sendError('Something went wrong');
      expect(writtenData.some((d) => d.includes('event: error'))).toBe(true);
    });

    it('sendCost sends cost event', () => {
      const writer = new SSEWriter(mockRes);
      writer.sendCost(0.05);
      expect(writtenData.some((d) => d.includes('event: cost'))).toBe(true);
    });

    it('sendComplete sends complete event', () => {
      const writer = new SSEWriter(mockRes);
      writer.sendComplete();
      expect(writtenData.some((d) => d.includes('event: complete'))).toBe(true);
    });
  });

  describe('close', () => {
    it('ends the response', () => {
      const writer = new SSEWriter(mockRes);
      writer.close();
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('only closes once', () => {
      const writer = new SSEWriter(mockRes);
      writer.close();
      writer.close();
      expect(mockRes.end).toHaveBeenCalledTimes(1);
    });
  });

  describe('keep-alive', () => {
    it('sends keep-alive comments periodically', () => {
      void new SSEWriter(mockRes);
      // Advance timer by 15 seconds
      jest.advanceTimersByTime(15000);
      expect(writtenData.some((d) => d.includes('keep-alive'))).toBe(true);
    });
  });
});
