import { describe, it, expect } from '@jest/globals';
import { cn, capitalizeWords } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    const condition = false;
    expect(cn('foo', condition && 'bar', 'baz')).toBe('foo baz');
  });

  it('merges tailwind classes', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('handles arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });
});

describe('capitalizeWords', () => {
  it('capitalizes single word', () => {
    expect(capitalizeWords('hello')).toBe('Hello');
  });

  it('capitalizes multiple words', () => {
    expect(capitalizeWords('hello world')).toBe('Hello World');
  });

  it('handles already capitalized words', () => {
    expect(capitalizeWords('Hello World')).toBe('Hello World');
  });

  it('handles empty string', () => {
    expect(capitalizeWords('')).toBe('');
  });

  it('handles mixed case', () => {
    expect(capitalizeWords('hELLO wORLD')).toBe('HELLO WORLD');
  });
});
