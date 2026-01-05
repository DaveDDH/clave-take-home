'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useChatStore } from '@/stores/chat-store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

export function ChatContainer() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const messages = useChatStore((state) => state.messages);
  const isLoading = useChatStore((state) => state.isLoading);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const clearMessages = useChatStore((state) => state.clearMessages);

  const handleClear = () => {
    clearMessages();
    setConfirmOpen(false);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {messages.length > 0 && (
        <div className="border-b px-4 py-2">
          <div className="mx-auto flex max-w-5xl justify-end">
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="mr-1 h-4 w-4" />
              Clear Chat
            </Button>
          </div>
        </div>
      )}
      <MessageList messages={messages} isLoading={isLoading} onSendMessage={sendMessage} />
      <ChatInput onSend={sendMessage} disabled={isLoading} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Chat</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear all messages? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClear}>
              Clear Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
