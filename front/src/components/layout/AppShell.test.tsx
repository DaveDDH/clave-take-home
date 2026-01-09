import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock external dependencies
jest.unstable_mockModule('next/image', () => ({
  __esModule: true,
  default: function MockImage({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) {
    return React.createElement('img', { src, alt, ...props });
  },
}));

jest.unstable_mockModule('next/link', () => ({
  __esModule: true,
  default: function MockLink({ children, href, ...props }: { children: React.ReactNode; href: string }) {
    return React.createElement('a', { href, ...props }, children);
  },
}));

jest.unstable_mockModule('next/navigation', () => ({
  usePathname: () => '/copilot',
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.unstable_mockModule('@/lib/api', () => ({
  fetchConversations: jest.fn<() => Promise<[]>>().mockResolvedValue([]),
  fetchConversation: jest.fn(),
  streamChatResponse: jest.fn(),
}));

// Dynamic imports after mocks
const { AppShell } = await import('./AppShell');
const { useThemeStore } = await import('@/stores/theme-store');
const { useChatStore } = await import('@/stores/chat-store');

describe('AppShell', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light' });
    useChatStore.setState({
      conversationId: null,
      pendingConversation: null,
      messages: [],
    });
  });

  it('renders children in main element', () => {
    render(
      <AppShell>
        <div data-testid="test-content">Test Content</div>
      </AppShell>
    );
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(screen.getByTestId('test-content'));
  });

  it('renders header', () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders sidebar navigation', () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
