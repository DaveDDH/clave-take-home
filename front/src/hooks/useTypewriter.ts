import { useState, useEffect } from 'react';

interface UseTypewriterOptions {
  text: string;
  enabled: boolean;
  speed?: number; // characters per second
  onComplete?: () => void; // Called when animation completes
}

export function useTypewriter({ text, enabled, speed = 50, onComplete }: UseTypewriterOptions) {
  // Store both text and index together to reset properly
  const [state, setState] = useState({ text: '', index: 0 });

  // Typing animation effect
  useEffect(() => {
    // If not enabled, no animation
    if (!enabled) {
      return;
    }

    // If text changed, determine if it's an incremental update or new message
    if (text !== state.text) {
      // Use requestAnimationFrame to avoid synchronous setState
      requestAnimationFrame(() => {
        // If new text starts with old text, it's incremental - continue from current position
        if (text.startsWith(state.text)) {
          setState({ text, index: state.index });
        } else {
          // Completely new text - reset animation
          setState({ text, index: 0 });
        }
      });
      return;
    }

    // If we've displayed everything, call onComplete and return
    if (state.index >= text.length) {
      // Only call onComplete if we actually had content to animate
      if (text.length > 0) {
        if (onComplete) {
          onComplete();
        }
      }
      return;
    }

    // Calculate delay between characters (ms)
    const delay = 1000 / speed;

    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, index: prev.index + 1 }));
    }, delay);

    return () => clearTimeout(timer);
  }, [text, enabled, speed, state, onComplete]);

  // Return displayed text based on current state
  if (!enabled) {
    return text;
  }

  return text.slice(0, state.index);
}
