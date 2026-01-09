import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'node:util';

// Polyfill TextEncoder/TextDecoder for jsdom
Object.assign(global, { TextEncoder, TextDecoder });

// Mock ResizeObserver for recharts
global.ResizeObserver = class ResizeObserver {
  observe(): void { /* noop */ }
  unobserve(): void { /* noop */ }
  disconnect(): void { /* noop */ }
};
