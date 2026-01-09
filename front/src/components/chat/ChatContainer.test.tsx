import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
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

const { ChatContainer } = await import('./ChatContainer');
const { useChatStore } = await import('@/stores/chat-store');
const { useThemeStore } = await import('@/stores/theme-store');

describe('ChatContainer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useChatStore.setState({
      messages: [],
      isLoading: false,
      conversationId: null,
    });
    useThemeStore.setState({ theme: 'light' });
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders empty state with example queries', () => {
    render(<ChatContainer />);
    expect(screen.getByText(/got questions/i)).toBeInTheDocument();
  });

  it('renders message list when messages exist', () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'Hello' },
        { id: '2', role: 'assistant', content: 'Hi there!' },
      ],
    });

    render(<ChatContainer />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('renders chat input', () => {
    render(<ChatContainer />);
    expect(screen.getByPlaceholderText(/ask something/i)).toBeInTheDocument();
  });

  it('disables input when loading', () => {
    useChatStore.setState({ isLoading: true });
    render(<ChatContainer />);
    expect(screen.getByPlaceholderText(/ask something/i)).toBeDisabled();
  });
});
