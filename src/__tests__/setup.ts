import { config } from '../utils/config.js';
import os from 'node:os';
import fs from 'node:fs';

/** Global test setup: ensure tmpdir is always allowed for test backups. */
export function setup() {
  const tmpDir = fs.realpathSync(os.tmpdir());
  if (!config.allowedRoots.includes(tmpDir)) {
    config.allowedRoots.push(tmpDir);
  }
  // Also allow /tmp for macOS where realpath may differ
  if (!config.allowedRoots.includes('/tmp')) {
    config.allowedRoots.push('/tmp');
  }
}