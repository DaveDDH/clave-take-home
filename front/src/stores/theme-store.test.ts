import { describe, it, expect, beforeEach } from '@jest/globals';
import { useThemeStore } from './theme-store';

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light' });
  });

  describe('initial state', () => {
    it('starts with light theme', () => {
      const state = useThemeStore.getState();
      expect(state.theme).toBe('light');
    });
  });

  describe('setTheme', () => {
    it('sets theme to dark', () => {
      useThemeStore.getState().setTheme('dark');
      const state = useThemeStore.getState();
      expect(state.theme).toBe('dark');
    });

    it('sets theme to light', () => {
      useThemeStore.setState({ theme: 'dark' });
      useThemeStore.getState().setTheme('light');
      const state = useThemeStore.getState();
      expect(state.theme).toBe('light');
    });
  });

  describe('toggleTheme', () => {
    it('toggles from light to dark', () => {
      useThemeStore.getState().toggleTheme();
      const state = useThemeStore.getState();
      expect(state.theme).toBe('dark');
    });

    it('toggles from dark to light', () => {
      useThemeStore.setState({ theme: 'dark' });
      useThemeStore.getState().toggleTheme();
      const state = useThemeStore.getState();
      expect(state.theme).toBe('light');
    });
  });
});
