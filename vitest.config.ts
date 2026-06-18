import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      reporter: ['lcov', 'text-summary', 'clover'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.d.ts',
        'src/**/index.ts',
        'src/types/**',
      ],
    },
  },
});