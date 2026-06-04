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
}

export const HOME_DIR = os.homedir();

/** Server version — single source of truth. */
export const SERVER_VERSION = '0.6.0';

function parseAllowedRoots(): string[] {
  const raw = process.env.BACKUP_ALLOWED_ROOTS || '';
  if (!raw) {
    process.stderr.write('[backup-pro] WARNING: BACKUP_ALLOWED_ROOTS not set. Defaulting to current directory. Set it explicitly in production to restrict file access.\n');
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
  autoSaveIntervalMs: Number.parseInt(process.env.AUTO_SAVE_INTERVAL_MS || '30000', 10),
  maxPreviewChars: Number.parseInt(process.env.MAX_PREVIEW_CHARS || '10000', 10),
  allowedRoots: parseAllowedRoots(),
  logLevel: parseLogLevel(),
  batchConcurrency: Number.parseInt(process.env.BATCH_CONCURRENCY || '5', 10),
  maxBackupsPerFile: Number.parseInt(process.env.MAX_BACKUPS_PER_FILE || '0', 10),
  maxFileSize: Number.parseInt(process.env.MAX_FILE_SIZE || '104857600', 10),
};