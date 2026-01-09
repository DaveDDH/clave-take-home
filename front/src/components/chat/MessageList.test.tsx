import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock next/image
jest.unstable_mockModule('next/image', () => ({
  __esModule: true,
  default: function MockImage({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) {
    return React.createElement('img', { src, alt, ...props });
  },
}));

// Mock api
jest.unstable_mockModule('@/lib/api', () => ({
  streamChatResponse: jest.fn(),
  fetchConversation: jest.fn(),
}));

const { MessageList } = await import('./MessageList');
const { useThemeStore } = await import('@/stores/theme-store');
const { useChatStore } = await import('@/stores/chat-store');

describe('MessageList', () => {
  const mockOnSendMessage = jest.fn();

  beforeEach(() => {
    mockOnSendMessage.mockClear();
    useThemeStore.setState({ theme: 'light' });
    useChatStore.setState({ messages: [] });
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('shows empty state when no messages', () => {
    render(<MessageList messages={[]} isLoading={false} onSendMessage={mockOnSendMessage} />);
    expect(screen.getByText(/got questions/i)).toBeInTheDocument();
  });

  it('shows example queries in empty state', () => {
    render(<MessageList messages={[]} isLoading={false} onSendMessage={mockOnSendMessage} />);
    expect(screen.getByText(/what was the revenue yesterday/i)).toBeInTheDocument();
  });

  it('calls onSendMessage when example query is clicked', () => {
    render(<MessageList messages={[]} isLoading={false} onSendMessage={mockOnSendMessage} />);
    const exampleQuery = screen.getByText(/what was the revenue yesterday/i);
    fireEvent.click(exampleQuery);
    expect(mockOnSendMessage).toHaveBeenCalledWith('What was the revenue yesterday?');
  });

  it('renders messages when provided', () => {
    const messages = [
      { id: '1', role: 'user' as const, content: 'Hello' },
      { id: '2', role: 'assistant' as const, content: 'Hi there!' },
    ];
    render(<MessageList messages={messages} isLoading={false} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('shows typing indicator when loading', () => {
    const messages = [{ id: '1', role: 'user' as const, content: 'Hello' }];
    render(<MessageList messages={messages} isLoading={true} />);
    expect(screen.getByAltText('Loading')).toBeInTheDocument();
  });

  it('shows typing indicator when loading with no messages', () => {
    render(<MessageList messages={[]} isLoading={true} />);
    // When loading with no messages, show typing indicator (not empty state)
    expect(screen.getByAltText('Loading')).toBeInTheDocument();
  });

  it('uses dark mode logo when theme is dark', () => {
    useThemeStore.setState({ theme: 'dark' });
    render(<MessageList messages={[]} isLoading={false} />);
    const logo = screen.getByAltText('Clave');
    expect(logo).toHaveAttribute('src', '/clave-logo-icon_darkmode.png');
  });

  it('calculates total conversation cost', () => {
    const messages = [
      { id: '1', role: 'user' as const, content: 'Hello' },
      { id: '2', role: 'assistant' as const, content: 'Hi', cost: 0.01 },
      { id: '3', role: 'user' as const, content: 'Question' },
      { id: '4', role: 'assistant' as const, content: 'Answer', cost: 0.02 },
    ];
    render(<MessageList messages={messages} isLoading={false} />);
    // Total should be 0.03 - find any element containing this
    const totalElements = screen.getAllByText(/total.*0\.0300/i);
    expect(totalElements.length).toBeGreaterThan(0);
  });
});
