const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5006';

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequestOptions {
  useConsistency?: boolean;
  debug?: boolean;
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'radial';
  data: Record<string, unknown>[];
  config?: {
    xKey: string;
    yKey: string;
  };
}

// SSE streaming API
export interface StreamHandlers {
  onClassification?: (data: {
    isDataQuery: boolean;
    chartType: string;
    conversationalResponse: string;
  }) => void;
  onProgress?: (message: string, step: string) => void;
  onSQL?: (sql: string) => void;
  onChart?: (charts: ChartData[]) => void;
  onContentDelta?: (token: string) => void;
  onContent?: (content: string) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export async function streamChatResponse(
  messages: ApiMessage[],
  options: ChatRequestOptions,
  handlers: StreamHandlers
): Promise<() => void> {
  const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ messages, options }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start stream: ${response.statusText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const readStream = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue;

          const eventMatch = line.match(/^event: (.+)/m);
          const dataMatch = line.match(/^data: (.+)/m);

          if (eventMatch && dataMatch) {
            const eventType = eventMatch[1];
            const dataStr = dataMatch[1];

            try {
              const event = JSON.parse(dataStr);

              switch (eventType) {
                case 'classification':
                  handlers.onClassification?.(event);
                  break;
                case 'progress':
                  handlers.onProgress?.(event.message, event.step);
                  break;
                case 'sql':
                  handlers.onSQL?.(event.sql);
                  break;
                case 'chart':
                  handlers.onChart?.(event.charts);
                  break;
                case 'content-delta':
                  handlers.onContentDelta?.(event.token);
                  break;
                case 'content':
                  handlers.onContent?.(event.content);
                  break;
                case 'complete':
                  handlers.onComplete?.();
                  break;
                case 'error':
                  handlers.onError?.(event.error);
                  break;
              }
            } catch (err) {
              console.error('Failed to parse SSE event:', err);
            }
          }
        }
      }
    } catch (error) {
      handlers.onError?.(
        error instanceof Error ? error.message : 'Stream failed'
      );
    }
  };

  readStream();

  return () => reader.cancel();
}
