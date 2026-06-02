import { backupNotFoundError } from '../utils/validate.js';
import { pathExists, stat, readFile } from '../utils/fs.js';
import { BackupStore } from '../utils/store.js';
import { BackupMetadata } from '../types/index.js';
import { calculateFileHash } from '../utils/hashing.js';
import { formatFileSize } from '../utils/formatting.js';

/** Detailed backup information including existence checks, size, and hash comparison. */
export interface BackupDetails extends BackupMetadata {
  backupPath: string;
  backupExists: boolean;
  originalExists: boolean;
  currentSize?: number;
  hashMatch?: boolean;
  sizeFormatted: string;
  warnings?: string[];
}

/** Retrieves detailed information about a backup, checking file existence and hash integrity. */
export async function getBackup(
  backupId: string,
  backups: BackupStore
): Promise<BackupDetails> {
  const backup = backups.get(backupId);
  if (!backup) {
    throw backupNotFoundError(backupId);
  }

  const backupExists = await pathExists(backup.backupPath);
  const originalExists = await pathExists(backup.metadata.originalPath);
  const warnings: string[] = [];

  let currentSize: number | undefined;
  let hashMatch: boolean | undefined;

  if (originalExists && backupExists && backup.metadata.fileHash) {
    try {
      const currentContent = await readFile(backup.metadata.originalPath);
      const currentHash = calculateFileHash(currentContent);
      hashMatch = currentHash === backup.metadata.fileHash;
      const currentStats = await stat(backup.metadata.originalPath);
      currentSize = currentStats.size;
    } catch (error) {
      warnings.push(`Failed to compare hashes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let actualSize = backup.metadata.size || 0;
  if (backupExists) {
    try {
      const backupStats = await stat(backup.backupPath);
      actualSize = backupStats.size;
    } catch (error) {
      warnings.push(`Failed to get backup file size: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    ...backup.metadata,
    backupPath: backup.backupPath,
    backupExists,
    originalExists,
    currentSize,
    hashMatch,
    size: actualSize,
    sizeFormatted: formatFileSize(actualSize),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

/** Formats backup details into a human-readable string. */
export function formatBackupDetails(details: BackupDetails): string {
  const lines: string[] = [];

  lines.push(`📋 Backup Details: ${details.id}`);
  lines.push('═'.repeat(50));
  lines.push('');
  lines.push(`📁 Original File: ${details.originalPath}`);
  lines.push(`📍 Backup Location: ${details.backupPath}`);
  lines.push(`📅 Created: ${new Date(details.timestamp).toLocaleString()}`);
  lines.push(`💾 Size: ${details.sizeFormatted}`);

  if (details.description) {
    lines.push(`📝 Description: ${details.description}`);
  }

  if (details.tags && details.tags.length > 0) {
    lines.push(`🏷️  Tags: ${details.tags.map(t => `#${t}`).join(' ')}`);
  }

  lines.push('');
  lines.push('Status:');
  lines.push(`  • Backup file: ${details.backupExists ? '✅ exists' : '❌ missing'}`);
  lines.push(`  • Original file: ${details.originalExists ? '✅ exists' : '⚠️  deleted/moved'}`);

  if (details.hashMatch !== undefined) {
    lines.push(`  • Content: ${details.hashMatch ? '✅ unchanged' : '⚠️  modified since backup'}`);
  }

  if (details.currentSize !== undefined && details.size !== details.currentSize) {
    lines.push(`  • Current size: ${formatFileSize(details.currentSize)} (was ${details.sizeFormatted})`);
  }

  if (details.fileHash) {
    lines.push(`  • Hash: ${details.fileHash}`);
  }

  if (details.relatedFiles && details.relatedFiles.length > 0) {
    lines.push('');
    lines.push('🔗 Related Files:');
    for (const file of details.relatedFiles) {
      lines.push(`   • ${file}`);
    }
  }

  if (details.projectContext) {
    lines.push('');
    lines.push(`📂 Project Context: ${details.projectContext}`);
  }

  if (details.author) {
    lines.push(`👤 Author: ${details.author}`);
  }

  if (details.warnings && details.warnings.length > 0) {
    lines.push('');
    lines.push('⚠️  Warnings:');
    for (const w of details.warnings) {
      lines.push(`   • ${w}`);
    }
  }

  return lines.join('\n');
}