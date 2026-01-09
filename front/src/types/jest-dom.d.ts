import '@testing-library/jest-dom';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module '@jest/expect' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Matchers<R = void, T = unknown>
    extends TestingLibraryMatchers<typeof expect.stringContaining, R> {}
}
