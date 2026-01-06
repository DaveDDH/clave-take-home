import { useState, useEffect } from 'react';

interface UseTypewriterOptions {
  text: string;
  enabled: boolean;
  speed?: number; // characters per second
}

export function useTypewriter({ text, enabled, speed = 50 }: UseTypewriterOptions) {
  // Store both text and index together to reset properly
  const [state, setState] = useState({ text: '', index: 0 });

  // Typing animation effect
  useEffect(() => {
    // If not enabled, no animation
    if (!enabled) {
      console.log('[TYPEWRITER] Hook disabled, returning full text');
      return;
    }

    // If text changed, determine if it's an incremental update or new message
    if (text !== state.text) {
      console.log('[TYPEWRITER] Text changed:', {
        oldText: state.text.substring(0, 50) + '...',
        newText: text.substring(0, 50) + '...',
        oldLength: state.text.length,
        newLength: text.length,
        currentIndex: state.index,
        startsWithOld: text.startsWith(state.text),
      });

      // Use requestAnimationFrame to avoid synchronous setState
      requestAnimationFrame(() => {
        // If new text starts with old text, it's incremental - continue from current position
        if (text.startsWith(state.text)) {
          console.log('[TYPEWRITER] Incremental update, continuing from index:', state.index);
          setState({ text, index: state.index });
        } else {
          // Completely new text - reset animation
          console.log('[TYPEWRITER] New text, resetting animation');
          setState({ text, index: 0 });
        }
      });
      return;
    }

    // If we've displayed everything, nothing to do
    if (state.index >= text.length) {
      return;
    }

    console.log('[TYPEWRITER] Advancing index from', state.index, 'to', state.index + 1, 'of', text.length);

    // Calculate delay between characters (ms)
    const delay = 1000 / speed;

    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, index: prev.index + 1 }));
    }, delay);

    return () => clearTimeout(timer);
  }, [text, enabled, speed, state]);

  // Return displayed text based on current state
  if (!enabled) {
    return text;
  }

  return text.slice(0, state.index);
}
