module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/setupTests.ts',
  ],
  coverageThreshold: {
    // UI 组件与 hooks 目前没有测试，只对已覆盖的逻辑层设门槛
    './src/services/protocols/': {
      branches: 50,
      functions: 55,
      lines: 65,
      statements: 65,
    },
    './src/store/slices/': {
      branches: 40,
      functions: 30,
      lines: 40,
      statements: 40,
    },
  },
};