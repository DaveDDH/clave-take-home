import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { useThemeStore } from '@/stores/theme-store';
import { useChatStore } from '@/stores/chat-store';

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  },
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/copilot',
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock api fetchConversations
jest.mock('@/lib/api', () => ({
  fetchConversations: jest.fn<() => Promise<[]>>().mockResolvedValue([]),
}));

// Import after mocks
import { AppShell } from './AppShell';

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
