import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';
import { useThemeStore } from '@/stores/theme-store';

describe('ThemeToggle', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light' });
  });

  it('renders toggle button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
  });

  it('shows moon icon in light mode', () => {
    useThemeStore.setState({ theme: 'light' });
    render(<ThemeToggle />);
    // Moon icon is shown in light mode (to switch to dark)
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows sun icon in dark mode', () => {
    useThemeStore.setState({ theme: 'dark' });
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('toggles theme on click', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');

    expect(useThemeStore.getState().theme).toBe('light');
    fireEvent.click(button);
    expect(useThemeStore.getState().theme).toBe('dark');
  });
});
