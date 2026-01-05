import type { Message } from '@/types/chat';
import { ChartMessage } from './ChartMessage';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (message.charts?.length) {
    return (
      <div className="flex flex-col gap-2 justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
        {message.content && (
          <div className="max-w-[80%] rounded-2xl px-4 py-3 shadow-sm bg-muted">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.content}
            </p>
          </div>
        )}
        <ChartMessage charts={message.charts} />
      </div>
    );
  }

  return (
    <div className={`flex animate-in fade-in slide-in-from-bottom-2 duration-300 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </p>
      </div>
    </div>
  );
}
