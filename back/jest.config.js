/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^#(.*)\\.js$': '<rootDir>/src/$1',
    '^#(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/index.ts',
    // Exclude heavy API integration files
    '!src/ai/models/**',
    '!src/ai/actions/processUserMessage/streaming.ts',
    '!src/ai/actions/processUserMessage/self-consistency.ts',
    '!src/ai/actions/processUserMessage/sql-generation.ts',
    '!src/ai/actions/processUserMessage/sql-refinement.ts',
    '!src/ai/actions/processUserMessage/schema-linking.ts',
    '!src/ai/actions/processUserMessage/message-classifier.ts',
    '!src/ai/actions/processUserMessage/chart-inference.ts',
    '!src/ai/actions/processUserMessage/escalation.ts',
    '!src/ai/actions/processUserMessage/index.ts',
    '!src/routes/chat.ts',
    '!src/db/conversations.ts',
    '!src/db/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
