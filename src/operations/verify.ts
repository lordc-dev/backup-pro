import { backupNotFoundError } from '../utils/validate.js';
import { pathExists, readFile } from '../utils/fs.js';
import { BackupStore } from '../utils/store.js';
import { calculateFileHash } from '../utils/hashing.js';

/** Result of verifying a backup's integrity and comparison with the original file. */
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

/** Verifies a backup's integrity by checking file existence and hash comparison. */
export async function verifyBackup(
  backupId: string,
  backups: BackupStore
): Promise<VerifyResult> {
  const backup = backups.get(backupId);
  if (!backup) {
    throw backupNotFoundError(backupId);
  }

  const backupExists = await pathExists(backup.backupPath);
  const originalExists = await pathExists(backup.metadata.originalPath);
  const storedHash = backup.metadata.fileHash;
  const warnings: string[] = [];

  let backupHash: string | undefined;
  let currentHash: string | undefined;
  let backupIntact = false;
  let originalChanged = false;

  if (backupExists) {
    try {
      const content = await readFile(backup.backupPath);
      backupHash = calculateFileHash(content);
      
      if (storedHash) {
        backupIntact = backupHash === storedHash;
      } else {
        backupIntact = true;
      }
    } catch (error) {
      warnings.push(`Error verifying backup integrity: ${error instanceof Error ? error.message : String(error)}`);
      backupIntact = false;
    }
  }

  if (originalExists) {
    try {
      const content = await readFile(backup.metadata.originalPath);
      currentHash = calculateFileHash(content);
      
      if (storedHash) {
        originalChanged = currentHash !== storedHash;
      }
    } catch (error) {
      warnings.push(`Error reading original file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let message: string;
  if (!backupExists) {
    message = '❌ Backup file is missing!';
  } else if (!backupIntact) {
    message = '⚠️ Backup may be corrupted - hash mismatch';
  } else if (!originalExists) {
    message = '✅ Backup intact | Original file deleted/moved';
  } else if (originalChanged) {
    message = '✅ Backup intact | Original has been modified since backup';
  } else {
    message = '✅ Backup intact | Original unchanged';
  }

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

/** Formats a verify result into a human-readable string. */
export function formatVerifyResult(result: VerifyResult): string {
  const lines: string[] = [];

  lines.push(`🔍 Verification: ${result.backupId}`);
  lines.push('═'.repeat(50));
  lines.push('');
  lines.push(result.message);
  lines.push('');
  lines.push(`📁 Original: ${result.originalPath}`);
  lines.push(`   Status: ${result.originalExists ? (result.originalChanged ? '📝 modified' : '✅ unchanged') : '⚠️ missing'}`);
  lines.push('');
  lines.push(`💾 Backup: ${result.backupExists ? '✅ exists' : '❌ missing'}`);
  lines.push(`   Integrity: ${result.backupIntact ? '✅ intact' : '❌ corrupted/missing'}`);

  if (result.storedHash || result.backupHash || result.currentHash) {
    lines.push('');
    lines.push('🔐 Hashes:');
    if (result.storedHash) {
      lines.push(`   Stored:  ${result.storedHash}`);
    }
    if (result.backupHash) {
      lines.push(`   Backup:  ${result.backupHash} ${result.backupHash === result.storedHash ? '✓' : '✗'}`);
    }
    if (result.currentHash) {
      lines.push(`   Current: ${result.currentHash} ${result.currentHash === result.storedHash ? '(unchanged)' : '(changed)'}`);
    }
  }

  if (result.warnings && result.warnings.length > 0) {
    lines.push('');
    lines.push('⚠️  Warnings:');
    for (const w of result.warnings) {
      lines.push(`   • ${w}`);
    }
  }

  return lines.join('\n');
}