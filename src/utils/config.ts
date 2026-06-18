import * as path from 'node:path';
import * as os from 'node:os';

/** Configuration for the backup MCP server. */
export interface BackupConfig {
  backupDir: string;
  autoSaveIntervalMs: number;
  maxPreviewChars: number;
  allowedRoots: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  batchConcurrency: number;
  maxBackupsPerFile: number;
  maxFileSize: number;
  maxDiffSize: number;
  maxHashSize: number;
}

export const HOME_DIR = os.homedir();

/** Server version — single source of truth. */
export const SERVER_VERSION = '0.6.0';

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function parseAllowedRoots(): string[] {
  const raw = process.env.BACKUP_ALLOWED_ROOTS || '';
  if (!raw) {
    console.warn('[backup-pro] WARNING: BACKUP_ALLOWED_ROOTS not set. Defaulting to current working directory. Set BACKUP_ALLOWED_ROOTS explicitly in production to restrict file access.');
    return [process.cwd()];
  }
  const roots = raw
    .split(':')
    .map(r => r.startsWith('~/') ? path.join(HOME_DIR, r.substring(1)) : r)
    .filter(r => r.length > 0);
  return roots.length > 0 ? roots : [process.cwd()];
}

function parseLogLevel(): 'debug' | 'info' | 'warn' | 'error' {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return 'info';
}

/** Resolved server configuration derived from environment variables and defaults. */
export const config: BackupConfig = {
  backupDir: process.env.BACKUP_DIR || path.join(HOME_DIR, '.mcp-backups'),
  autoSaveIntervalMs: parsePositiveInt(process.env.AUTO_SAVE_INTERVAL_MS, 30000),
  maxPreviewChars: parsePositiveInt(process.env.MAX_PREVIEW_CHARS, 10000),
  allowedRoots: parseAllowedRoots(),
  logLevel: parseLogLevel(),
  batchConcurrency: parsePositiveInt(process.env.BATCH_CONCURRENCY, 5),
  maxBackupsPerFile: parseNonNegativeInt(process.env.MAX_BACKUPS_PER_FILE, 0),
  maxFileSize: parsePositiveInt(process.env.MAX_FILE_SIZE, 104857600),
  maxDiffSize: parsePositiveInt(process.env.MAX_DIFF_SIZE, 10485760),
  maxHashSize: parsePositiveInt(process.env.MAX_HASH_SIZE, 104857600),
};