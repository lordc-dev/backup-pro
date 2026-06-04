import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { config } from './config.js';
import { pathExists, mkdirp } from './fs.js';

/** Computes the SHA-256 hash of file content. */
export function calculateFileHash(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Ensures the backup directory exists, creating it if needed. */
export async function ensureBackupDir(): Promise<void> {
  if (!(await pathExists(config.backupDir))) {
    await mkdirp(config.backupDir);
  }
}

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

/** Parses a backup filename to extract the embedded timestamp, or null on failure. */
export function parseBackupFileName(fileName: string): { timestamp: string | null } {
  const parts = fileName.split('.');
  if (parts.length >= 4) {
    const timestampPart = parts[parts.length - 2];
    try {
      const timestamp = timestampPart.replace(/-/g, ':');
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return { timestamp: date.toISOString() };
      }
    } catch {
      // Timestamp parsing is best-effort; malformed timestamps return null
    }
  }
  return { timestamp: null };
}