'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/theme-store';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;

    // Remove both classes first to avoid conflicts
    root.classList.remove('light', 'dark');

    // Add the current theme class
    root.classList.add(theme);
  }, [theme]);

  return <>{children}</>;
}
