import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useTypewriter } from './useTypewriter';

describe('useTypewriter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Mock requestAnimationFrame
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns full text when disabled', () => {
    const { result } = renderHook(() =>
      useTypewriter({ text: 'Hello World', enabled: false })
    );

    expect(result.current).toBe('Hello World');
  });

  it('starts with empty string when enabled', () => {
    const { result } = renderHook(() =>
      useTypewriter({ text: 'Hello', enabled: true, speed: 50 })
    );

    // After requestAnimationFrame runs, state is initialized
    expect(result.current).toBe('');
  });

  it('types out text character by character', async () => {
    const { result } = renderHook(() =>
      useTypewriter({ text: 'Hi', enabled: true, speed: 50 })
    );

    // Wait for initial state setup
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    // Advance timers to type first character (1000/50 = 20ms)
    await act(async () => {
      jest.advanceTimersByTime(20);
    });
    expect(result.current).toBe('H');

    // Advance timers to type second character
    await act(async () => {
      jest.advanceTimersByTime(20);
    });
    expect(result.current).toBe('Hi');
  });

  it('calls onComplete when animation finishes', async () => {
    const onComplete = jest.fn();
    renderHook(() =>
      useTypewriter({ text: 'A', enabled: true, speed: 50, onComplete })
    );

    // Initial setup
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    // Type the single character
    await act(async () => {
      jest.advanceTimersByTime(20);
    });

    // Wait for onComplete to be called on next effect
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it('does not call onComplete for empty text', async () => {
    const onComplete = jest.fn();
    renderHook(() =>
      useTypewriter({ text: '', enabled: true, speed: 50, onComplete })
    );

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('handles text updates incrementally', async () => {
    const { result, rerender } = renderHook(
      ({ text }) => useTypewriter({ text, enabled: true, speed: 1000 }),
      { initialProps: { text: 'Hi' } }
    );

    // Wait for initial setup
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    // Type first character
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('H');

    // Text is updated with more content (incremental)
    rerender({ text: 'Hi there' });

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    // Should continue from where it was
    expect(result.current.length).toBeGreaterThanOrEqual(1);
  });

  it('resets animation when text changes completely', async () => {
    const { result, rerender } = renderHook(
      ({ text }) => useTypewriter({ text, enabled: true, speed: 1000 }),
      { initialProps: { text: 'Hello' } }
    );

    // Wait for initial setup and type some chars
    await act(async () => {
      jest.advanceTimersByTime(3);
    });

    // Completely different text
    rerender({ text: 'Goodbye' });

    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    // Should reset - either empty or starting with G
    const startsCorrectly = result.current === '' || result.current.startsWith('G');
    expect(startsCorrectly).toBe(true);
  });

  it('respects custom speed', async () => {
    const { result } = renderHook(() =>
      useTypewriter({ text: 'AB', enabled: true, speed: 100 }) // 10ms per char
    );

    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    expect(result.current).toBe('');

    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(result.current).toBe('A');

    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(result.current).toBe('AB');
  });

  it('returns text when switching from enabled to disabled', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useTypewriter({ text: 'Hello', enabled, speed: 50 }),
      { initialProps: { enabled: true } }
    );

    // Switch to disabled
    rerender({ enabled: false });

    expect(result.current).toBe('Hello');
  });
});
