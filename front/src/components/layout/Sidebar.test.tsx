import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockPush = jest.fn();
let mockPathname = '/copilot';
const mockFetchConversations = jest.fn<() => Promise<Array<{ id: string; preview: string; created_at: string; updated_at: string; message_count: number }>>>();
const mockStreamChatResponse = jest.fn();
const mockFetchConversation = jest.fn();

// Mock all external dependencies before imports
jest.unstable_mockModule('next/link', () => ({
  __esModule: true,
  default: function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string }) {
    return React.createElement('a', { href, ...props }, children);
  },
}));

jest.unstable_mockModule('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.unstable_mockModule('@/lib/api', () => ({
  fetchConversations: () => mockFetchConversations(),
  fetchConversation: mockFetchConversation,
  streamChatResponse: mockStreamChatResponse,
}));

// Dynamic import after mocks
const { Sidebar } = await import('./Sidebar');
const { useChatStore } = await import('@/stores/chat-store');

describe('Sidebar', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathname = '/copilot';
    mockFetchConversations.mockResolvedValue([]);
    localStorage.clear();
    useChatStore.setState({
      conversationId: null,
      pendingConversation: null,
      messages: [],
      isLoading: false,
    });
  });

  it('renders navigation', () => {
    render(<Sidebar />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('renders New Chat button', () => {
    render(<Sidebar />);
    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();
  });

  it('renders Dashboard link', () => {
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('navigates to copilot on New Chat click', () => {
    render(<Sidebar />);
    const newChatButton = screen.getByRole('button', { name: /new chat/i });
    fireEvent.click(newChatButton);
    expect(mockPush).toHaveBeenCalledWith('/copilot');
  });

  it('shows conversation history when conversations exist', async () => {
    mockFetchConversations.mockResolvedValue([
      { id: 'conv-1', preview: 'Test conversation', created_at: '2024-01-01', updated_at: '2024-01-01', message_count: 1 },
    ]);

    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Test conversation')).toBeInTheDocument();
    });
  });

  it('loads conversation when clicking on history item', async () => {
    mockFetchConversations.mockResolvedValue([
      { id: 'conv-1', preview: 'Test conversation', created_at: '2024-01-01', updated_at: '2024-01-01', message_count: 1 },
    ]);

    render(<Sidebar />);

    await waitFor(() => {
      const convButton = screen.getByText('Test conversation');
      fireEvent.click(convButton);
    });

    expect(mockPush).toHaveBeenCalledWith('/copilot');
  });

  it('shows pending conversation', async () => {
    useChatStore.setState({
      pendingConversation: { tempId: 'temp-1', preview: 'Pending message' },
    });

    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Pending message')).toBeInTheDocument();
    });
  });

  it('highlights active conversation', async () => {
    useChatStore.setState({ conversationId: 'conv-1' });
    mockFetchConversations.mockResolvedValue([
      { id: 'conv-1', preview: 'Active conversation', created_at: '2024-01-01', updated_at: '2024-01-01', message_count: 1 },
    ]);

    render(<Sidebar />);

    await waitFor(() => {
      const convButton = screen.getByText('Active conversation');
      expect(convButton.closest('button')).toHaveClass('bg-primary/10');
    });
  });

  it('highlights dashboard when on dashboard route', () => {
    mockPathname = '/dashboard';
    render(<Sidebar />);

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).toHaveClass('bg-primary/10');
  });

  it('uses cached conversations on mount', async () => {
    const cachedConversations = [
      { id: 'cached-1', preview: 'Cached conversation', created_at: '2024-01-01', updated_at: '2024-01-01', message_count: 1 },
    ];
    localStorage.setItem('clave_conversations_cache', JSON.stringify(cachedConversations));

    render(<Sidebar />);

    // Should show cached data immediately
    await waitFor(() => {
      expect(screen.getByText('Cached conversation')).toBeInTheDocument();
    });
  });

  it('handles fetch error gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchConversations.mockRejectedValue(new Error('Network error'));

    render(<Sidebar />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it('shows default preview for conversation without preview', async () => {
    mockFetchConversations.mockResolvedValue([
      { id: 'conv-1', preview: '', created_at: '2024-01-01', updated_at: '2024-01-01', message_count: 1 },
    ]);

    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText('New conversation')).toBeInTheDocument();
    });
  });

  it('handles localStorage parse error gracefully', () => {
    localStorage.setItem('clave_conversations_cache', 'invalid json');
    render(<Sidebar />);
    // Should not throw
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
