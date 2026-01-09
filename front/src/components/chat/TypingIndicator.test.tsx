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

const { TypingIndicator } = await import('./TypingIndicator');
const { useThemeStore } = await import('@/stores/theme-store');

describe('TypingIndicator', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light' });
  });

  it('renders loading image', () => {
    render(<TypingIndicator />);
    expect(screen.getByAltText('Loading')).toBeInTheDocument();
  });

  it('uses light mode logo by default', () => {
    render(<TypingIndicator />);
    const img = screen.getByAltText('Loading');
    expect(img).toHaveAttribute('src', '/clave-logo-icon.png');
  });

  it('uses dark mode logo when theme is dark', () => {
    useThemeStore.setState({ theme: 'dark' });
    render(<TypingIndicator />);
    const img = screen.getByAltText('Loading');
    expect(img).toHaveAttribute('src', '/clave-logo-icon_darkmode.png');
  });
});
