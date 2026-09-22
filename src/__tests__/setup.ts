import { config } from '../utils/config.js';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

/** Global test setup: isolate backups from the real home and allow tmpdir. */
export function setup() {
  // Tests must never write to the real backup dir (~/.mcp-backups or BACKUP_DIR).
  // config.ts caches its value at import time, so we override the resolved config here.
  (config as { backupDir: string }).backupDir = path.join(os.tmpdir(), 'backup-pro-test-backups');
  fs.mkdirSync(config.backupDir, { recursive: true });

  const tmpDir = fs.realpathSync(os.tmpdir());
  if (!config.allowedRoots.includes(tmpDir)) {
    config.allowedRoots.push(tmpDir);
  }
  // Also allow /tmp for macOS where realpath may differ
  if (!config.allowedRoots.includes('/tmp')) {
    config.allowedRoots.push('/tmp');
  }
}

setup();