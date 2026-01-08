import type { Response } from 'express';
import type { ChartData } from '../ai/actions/processUserMessage/index.js';

export class SSEWriter {
  private res: Response;
  private closed = false;
  private keepAliveInterval?: NodeJS.Timeout;

  constructor(res: Response) {
    this.res = res;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Disable socket buffering for immediate sending
    if (res.socket) {
      res.socket.setNoDelay(true);
    }

    // Send keep-alive comment every 15 seconds
    this.keepAliveInterval = setInterval(() => {
      if (!this.closed) {
        this.res.write(': keep-alive\n\n');
      }
    }, 15000);

    // Detect client disconnect
    res.on('close', () => {
      this.close();
    });
  }

  sendEvent(type: string, data: unknown): void {
    if (this.closed || this.res.writableEnded) {
      return;
    }

    try {
      const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
      this.res.write(message);
      // Data is sent immediately due to setNoDelay(true) in constructor
    } catch (error) {
      console.error('Failed to send SSE event:', error);
    }
  }

  sendStart(): void {
    this.sendEvent('start', { message: 'Processing started' });
  }

  sendClassification(data: {
    isDataQuery: boolean;
    chartType: string | null;
    conversationalResponse: string;
  }): void {
    this.sendEvent('classification', data);
  }

  sendProgress(message: string, step: string): void {
    this.sendEvent('progress', { message, step });
  }

  sendSQL(sql: string): void {
    this.sendEvent('sql', { sql });
  }

  sendChart(charts: ChartData[]): void {
    this.sendEvent('chart', { charts });
  }

  sendContentDelta(token: string): void {
    this.sendEvent('content-delta', { token });
  }

  sendContent(content: string): void {
    this.sendEvent('content', { content });
  }

  sendError(error: string): void {
    this.sendEvent('error', { error });
  }

  sendCost(totalCost: number): void {
    this.sendEvent('cost', { totalCost });
  }

  sendComplete(): void {
    this.sendEvent('complete', {});
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;

    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    if (!this.res.writableEnded) {
      this.res.end();
    }
  }
}
