import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { useThemeStore } from '@/stores/theme-store';

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Import after mocks
import { Header } from './Header';

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
