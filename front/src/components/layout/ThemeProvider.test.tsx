import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from './ThemeProvider';
import { useThemeStore } from '@/stores/theme-store';

describe('ThemeProvider', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light' });
    document.documentElement.classList.remove('light', 'dark');
  });

  it('renders children', () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Content</div>
      </ThemeProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('adds light class to document element', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('adds dark class when theme is dark', () => {
    useThemeStore.setState({ theme: 'dark' });
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes old theme class when theme changes', () => {
    const { rerender } = render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('light')).toBe(true);

    useThemeStore.setState({ theme: 'dark' });
    rerender(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });
});
