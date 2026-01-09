import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock next/image
jest.unstable_mockModule('next/image', () => ({
  __esModule: true,
  default: function MockImage({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) {
    return React.createElement('img', { src, alt, ...props });
  },
}));

// Dynamic imports after mocks
const { Header } = await import('./Header');
const { useThemeStore } = await import('@/stores/theme-store');

describe('Header', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light' });
  });

  it('renders header element', () => {
    render(<Header />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('shows light mode logo by default', () => {
    render(<Header />);
    const logo = screen.getByAltText('Clave');
    expect(logo).toHaveAttribute('src', '/clave-logo.webp');
  });

  it('shows dark mode logo when theme is dark', () => {
    useThemeStore.setState({ theme: 'dark' });
    render(<Header />);
    const logo = screen.getByAltText('Clave');
    expect(logo).toHaveAttribute('src', '/clave-logo_darkmode.webp');
  });

  it('contains ThemeToggle', () => {
    render(<Header />);
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
  });
});
