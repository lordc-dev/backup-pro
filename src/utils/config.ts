import * as path from 'node:path';
import * as os from 'node:os';

/** Configuration for the backup MCP server. */
export interface BackupConfig {
  backupDir: string;
  autoSaveIntervalMs: number;
  maxPreviewChars: number;
  allowedRoots: string[];
  isUnrestricted: boolean;
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

function expandTilde(p: string): string {
  if (p === '~') return HOME_DIR;
  if (p.startsWith('~/')) return path.join(HOME_DIR, p.substring(1));
  return p;
}

function expandRoot(r: string): string {
  return expandTilde(r);
}

function parseAllowedRoots(): { roots: string[]; unrestricted: boolean } {
  const raw = process.env.BACKUP_ALLOWED_ROOTS || '';
  if (raw === '*') {
    console.warn('[backup-pro] WARNING: BACKUP_ALLOWED_ROOTS=* — roots restriction disabled. Unrestricted filesystem access. Use only in trusted dev environments.');
    return { roots: [], unrestricted: true };
  }
  if (!raw) {
    console.warn('[backup-pro] WARNING: BACKUP_ALLOWED_ROOTS not set. Defaulting to current working directory. Set BACKUP_ALLOWED_ROOTS explicitly in production to restrict file access.');
    return { roots: [process.cwd()], unrestricted: false };
  }
  const roots = raw
    .split(':')
    .map(expandRoot)
    .filter(r => r.length > 0);
  return roots.length > 0 ? { roots, unrestricted: false } : { roots: [process.cwd()], unrestricted: false };
}

function parseLogLevel(): 'debug' | 'info' | 'warn' | 'error' {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return 'info';
}

/** Resolved server configuration derived from environment variables and defaults. */
const _roots = parseAllowedRoots();

export const config: BackupConfig = {
  backupDir: expandTilde(process.env.BACKUP_DIR || path.join(HOME_DIR, '.mcp-backups')),
  autoSaveIntervalMs: parsePositiveInt(process.env.AUTO_SAVE_INTERVAL_MS, 30000),
  maxPreviewChars: parsePositiveInt(process.env.MAX_PREVIEW_CHARS, 10000),
  allowedRoots: _roots.roots,
  isUnrestricted: _roots.unrestricted,
  logLevel: parseLogLevel(),
  batchConcurrency: parsePositiveInt(process.env.BATCH_CONCURRENCY, 5),
  maxBackupsPerFile: parseNonNegativeInt(process.env.MAX_BACKUPS_PER_FILE, 0),
  maxFileSize: parsePositiveInt(process.env.MAX_FILE_SIZE, 104857600),
  maxDiffSize: parsePositiveInt(process.env.MAX_DIFF_SIZE, 10485760),
  maxHashSize: parsePositiveInt(process.env.MAX_HASH_SIZE, 104857600),
};