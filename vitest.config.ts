import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: process.env['CI'] ? ['verbose', 'junit'] : ['default'],
    outputFile: {
      junit: './test-results/junit.xml',
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts', 'src/application/ports/**/*.ts'],
      thresholds: {
        // Global thresholds — increase these as your codebase matures
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
        // Per-layer gates enforcing minimum on every architectural layer
        'src/domain/**': {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
        'src/application/**': {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
        'src/infrastructure/**': {
          statements: 70,
          branches: 65,
          functions: 70,
          lines: 70,
        },
        'src/presentation/**': {
          statements: 70,
          branches: 65,
          functions: 70,
          lines: 70,
        },
      },
    },
  },
});
