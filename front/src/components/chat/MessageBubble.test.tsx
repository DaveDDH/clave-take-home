import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock api
jest.unstable_mockModule('@/lib/api', () => ({
  streamChatResponse: jest.fn(),
  fetchConversation: jest.fn(),
}));

// Mock useTypewriter hook
jest.unstable_mockModule('@/hooks/useTypewriter', () => ({
  useTypewriter: ({ text }: { text: string }) => text,
}));

const { MessageBubble } = await import('./MessageBubble');
const { useChatStore } = await import('@/stores/chat-store');

describe('MessageBubble', () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      regenerateFrom: jest.fn<(messageId: string) => Promise<void>>(),
      markTypewriterComplete: jest.fn(),
    });

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      },
    });
  });

  it('renders user message', () => {
    const message = { id: '1', role: 'user' as const, content: 'Hello' };
    render(<MessageBubble message={message} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders assistant message', () => {
    const message = { id: '1', role: 'assistant' as const, content: 'Hi there!' };
    render(<MessageBubble message={message} />);
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('applies different styles for user vs assistant', () => {
    const userMessage = { id: '1', role: 'user' as const, content: 'User msg' };
    const { container: userContainer } = render(<MessageBubble message={userMessage} />);

    // User message should be right-justified
    expect(userContainer.querySelector('.justify-end')).toBeInTheDocument();
  });

  it('shows action buttons for assistant messages when last in block', () => {
    const message = { id: '1', role: 'assistant' as const, content: 'Response' };
    render(<MessageBubble message={message} isLastInBlock={true} />);

    // Should have copy and regenerate buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('does not show action buttons for user messages', () => {
    const message = { id: '1', role: 'user' as const, content: 'Hello' };
    render(<MessageBubble message={message} isLastInBlock={true} />);

    // Should not have action buttons
    const buttons = screen.queryAllByRole('button');
    expect(buttons.length).toBe(0);
  });

  it('shows cost when provided', () => {
    const message = { id: '1', role: 'assistant' as const, content: 'Response', cost: 0.05 };
    render(<MessageBubble message={message} isLastInBlock={true} />);
    expect(screen.getByText(/\$0\.0500/)).toBeInTheDocument();
  });

  it('shows total conversation cost when provided', () => {
    const message = { id: '1', role: 'assistant' as const, content: 'Response', cost: 0.05 };
    render(<MessageBubble message={message} isLastInBlock={true} totalConversationCost={0.1} />);
    expect(screen.getByText(/total.*\$0\.1000/i)).toBeInTheDocument();
  });

  it('shows save button when has charts in block', () => {
    const message = { id: '1', role: 'assistant' as const, content: 'Response' };
    render(<MessageBubble message={message} isLastInBlock={true} hasChartsInBlock={true} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3); // copy, regenerate, save
  });

  it('copies content to clipboard on copy click', async () => {
    const message = { id: '1', role: 'assistant' as const, content: 'Response to copy' };
    render(<MessageBubble message={message} isLastInBlock={true} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // First button is copy

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Response to copy');
  });

  it('calls regenerateFrom when regenerate is clicked', () => {
    const regenerateFrom = jest.fn<(messageId: string) => Promise<void>>();
    useChatStore.setState({ regenerateFrom });

    const message = { id: 'msg-1', role: 'assistant' as const, content: 'Response' };
    render(<MessageBubble message={message} isLastInBlock={true} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // Second button is regenerate

    expect(regenerateFrom).toHaveBeenCalledWith('msg-1');
  });

  it('renders chart when message has charts', () => {
    const message = {
      id: '1',
      role: 'assistant' as const,
      content: 'Here is the chart',
      charts: [{ type: 'bar' as const, data: [{ x: 1, y: 2 }] }],
    };
    render(<MessageBubble message={message} />);

    // Should render content
    expect(screen.getByText('Here is the chart')).toBeInTheDocument();
  });

  it('shows reasoning text when loading and has partial timestamp', () => {
    const message = {
      id: '1',
      role: 'assistant' as const,
      content: 'Response',
      partialTimestamp: Date.now() - 1000,
    };
    render(<MessageBubble message={message} isLoading={true} />);

    expect(screen.getByText('Reasoning...')).toBeInTheDocument();
  });

  it('shows thought duration when next message has final timestamp', () => {
    const now = Date.now();
    const message = {
      id: '1',
      role: 'assistant' as const,
      content: 'Response',
      partialTimestamp: now - 3000,
    };
    const nextMessage = {
      id: '2',
      role: 'assistant' as const,
      content: 'Chart',
      finalTimestamp: now,
    };
    render(<MessageBubble message={message} nextMessage={nextMessage} />);

    expect(screen.getByText(/thought for 3\.0 seconds/i)).toBeInTheDocument();
  });
});
