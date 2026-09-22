import { createHash } from 'node:crypto';
import * as path from 'node:path';

/** Generates a short deterministic backup ID from file path and timestamp. */
export function generateBackupId(filePath: string, timestamp: string): string {
  const hash = createHash('sha256')
    .update(`${filePath}-${timestamp}`)
    .digest('hex');
  return hash.substring(0, 16);
}

/** Generates a unique backup filename from the original path, ID, and timestamp. */
export function generateBackupFileName(originalPath: string, backupId: string, timestamp: string): string {
  const originalFileName = path.basename(originalPath);
  const isoTimestamp = new Date(timestamp).toISOString().replace(/:/g, '-');
  return `${originalFileName}.${backupId}.${isoTimestamp}.backup`;
}