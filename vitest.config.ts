import { defineConfig } from 'vitest/config';
import * as os from 'node:os';
import * as path from 'node:path';

export default defineConfig({
  test: {
    setupFiles: ['./src/__tests__/setup.ts'],
    // Tests must never write backups to the real home (~/.mcp-backups default).
    env: {
      BACKUP_DIR: path.join(os.tmpdir(), 'backup-pro-test-backups'),
    },
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