import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'node:util';

// Polyfill TextEncoder/TextDecoder for jsdom
Object.assign(globalThis, { TextEncoder, TextDecoder });

// Mock ResizeObserver for recharts
globalThis.ResizeObserver = class ResizeObserver {
  observe(): void { /* noop */ }
  unobserve(): void { /* noop */ }
  disconnect(): void { /* noop */ }
};
