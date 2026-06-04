import { backupNotFoundError } from '../utils/validate.js';
import { pathExists, readFile } from '../utils/fs.js';
import { BackupStore } from '../utils/store.js';
import { calculateFileHash } from '../utils/hashing.js';

export interface VerifyResult {
  backupId: string;
  originalPath: string;
  backupExists: boolean;
  originalExists: boolean;
  storedHash?: string;
  backupHash?: string;
  currentHash?: string;
  backupIntact: boolean;
  originalChanged: boolean;
  message: string;
  warnings?: string[];
}

async function computeBackupHash(backupPath: string, storedHash: string | undefined): Promise<{ hash: string | undefined; intact: boolean; error?: string }> {
  try {
    const content = await readFile(backupPath);
    const hash = calculateFileHash(content);
    return { hash, intact: storedHash ? hash === storedHash : true };
  } catch (error) {
    return { hash: undefined, intact: false, error: `Error verifying backup integrity: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function computeCurrentHash(originalPath: string, storedHash: string | undefined): Promise<{ hash: string | undefined; changed: boolean; error?: string }> {
  try {
    const content = await readFile(originalPath);
    const hash = calculateFileHash(content);
    return { hash, changed: storedHash ? hash !== storedHash : false };
  } catch (error) {
    return { hash: undefined, changed: false, error: `Error reading original file: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function buildVerifyMessage(backupExists: boolean, backupIntact: boolean, originalExists: boolean, originalChanged: boolean): string {
  if (!backupExists) return '❌ Backup file is missing!';
  if (!backupIntact) return '⚠️ Backup may be corrupted - hash mismatch';
  if (!originalExists) return '✅ Backup intact | Original file deleted/moved';
  if (originalChanged) return '✅ Backup intact | Original has been modified since backup';
  return '✅ Backup intact | Original unchanged';
}

export async function verifyBackup(backupId: string, backups: BackupStore): Promise<VerifyResult> {
  const backup = backups.get(backupId);
  if (!backup) throw backupNotFoundError(backupId);

  const backupExists = await pathExists(backup.backupPath);
  const originalExists = await pathExists(backup.metadata.originalPath);
  const storedHash = backup.metadata.fileHash;
  const warnings: string[] = [];
  let backupHash: string | undefined;
  let currentHash: string | undefined;
  let backupIntact = false;
  let originalChanged = false;

  if (backupExists) {
    const result = await computeBackupHash(backup.backupPath, storedHash);
    backupHash = result.hash;
    backupIntact = result.intact;
    if (result.error) warnings.push(result.error);
  }

  if (originalExists) {
    const result = await computeCurrentHash(backup.metadata.originalPath, storedHash);
    currentHash = result.hash;
    originalChanged = result.changed;
    if (result.error) warnings.push(result.error);
  }

  const message = buildVerifyMessage(backupExists, backupIntact, originalExists, originalChanged);

  return {
    backupId,
    originalPath: backup.metadata.originalPath,
    backupExists,
    originalExists,
    storedHash,
    backupHash,
    currentHash,
    backupIntact,
    originalChanged,
    message,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

function formatOriginalStatus(originalExists: boolean, originalChanged: boolean): string {
  if (!originalExists) return '⚠️ missing';
  return originalChanged ? '📝 modified' : '✅ unchanged';
}

function formatBackupStatus(backupExists: boolean, backupIntact: boolean): string {
  return `💾 Backup: ${backupExists ? '✅ exists' : '❌ missing'}\n   Integrity: ${backupIntact ? '✅ intact' : '❌ corrupted/missing'}`;
}

function formatHashes(result: VerifyResult): string[] {
  if (!(result.storedHash || result.backupHash || result.currentHash)) return [];
  const lines: string[] = ['', '🔐 Hashes:'];
  if (result.storedHash) lines.push(`   Stored:  ${result.storedHash}`);
  if (result.backupHash) lines.push(`   Backup:  ${result.backupHash} ${result.backupHash === result.storedHash ? '✓' : '✗'}`);
  if (result.currentHash) lines.push(`   Current: ${result.currentHash} ${result.currentHash === result.storedHash ? '(unchanged)' : '(changed)'}`);
  return lines;
}

function formatWarnings(warnings: string[]): string[] {
  if (warnings.length === 0) return [];
  const lines: string[] = ['', '⚠️  Warnings:'];
  for (const w of warnings) lines.push(`   • ${w}`);
  return lines;
}

/** Formats a verify result into a human-readable string. */
export function formatVerifyResult(result: VerifyResult): string {
  const lines: string[] = [
    `🔍 Verification: ${result.backupId}`,
    '═'.repeat(50),
    '',
    result.message,
    '',
    `📁 Original: ${result.originalPath}`,
    `   Status: ${formatOriginalStatus(result.originalExists, result.originalChanged)}`,
    '',
  ];
  lines.push(formatBackupStatus(result.backupExists, result.backupIntact));
  lines.push(...formatHashes(result));
  lines.push(...formatWarnings(result.warnings || []));
  return lines.join('\n');
}