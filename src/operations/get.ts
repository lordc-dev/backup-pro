import { backupNotFoundError, validateMetadataPath } from '../utils/validate.js';
import { pathExists, stat, readFile, assertFileSize } from '../utils/fs.js';
import { config } from '../utils/config.js';
import { BackupStore } from '../utils/store.js';
import { BackupMetadata, BackupInfo } from '../types/index.js';
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

async function computeCurrentState(backup: BackupInfo): Promise<{ currentSize: number | undefined; hashMatch: boolean | undefined; warnings: string[] }> {
  const originalExists = await pathExists(backup.metadata.originalPath);
  const backupExists = await pathExists(backup.backupPath);
  const warnings: string[] = [];
  let currentSize: number | undefined;
  let hashMatch: boolean | undefined;

  if (originalExists && backupExists && backup.metadata.fileHash) {
    try {
      const currentStats = await stat(backup.metadata.originalPath);
      currentSize = currentStats.size;
      const originalMtime = currentStats.mtime.getTime();
      const backupTime = new Date(backup.metadata.timestamp).getTime();
      if (originalMtime <= backupTime) {
        hashMatch = true;
        return { currentSize, hashMatch, warnings };
      }
      await assertFileSize(backup.metadata.originalPath, config.maxHashSize, 'get_backup');
      const currentContent = await readFile(backup.metadata.originalPath);
      const currentHash = calculateFileHash(currentContent);
      hashMatch = currentHash === backup.metadata.fileHash;
    } catch (error) {
      warnings.push(`Failed to compare hashes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { currentSize, hashMatch, warnings };
}

async function computeActualSize(backupPath: string, actualSize = 0): Promise<{ actualSize: number; warnings: string[] }> {
  const warnings: string[] = [];
  if (await pathExists(backupPath)) {
    try {
      const backupStats = await stat(backupPath);
      actualSize = backupStats.size;
    } catch (error) {
      warnings.push(`Failed to get backup file size: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { actualSize, warnings };
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

  if (backupExists) {
    validateMetadataPath(backup.backupPath, `backup ${backupId}`);
  }
  if (originalExists) {
    validateMetadataPath(backup.metadata.originalPath, `backup ${backupId} original`);
  }

  const { currentSize, hashMatch, warnings: stateWarnings } = await computeCurrentState(backup);
  const { actualSize, warnings: sizeWarnings } = await computeActualSize(backup.backupPath, backup.metadata.size);
  const warnings = [...stateWarnings, ...sizeWarnings];

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

function formatDetailsHeader(details: BackupDetails): string[] {
  const lines: string[] = [
    `📋 Backup Details: ${details.id}`,
    '═'.repeat(50),
    '',
    `📁 Original File: ${details.originalPath}`,
    `📍 Backup Location: ${details.backupPath}`,
    `📅 Created: ${new Date(details.timestamp).toLocaleString()}`,
    `💾 Size: ${details.sizeFormatted}`,
  ];

  if (details.description) {
    lines.push(`📝 Description: ${details.description}`);
  }

  if (details.tags && details.tags.length > 0) {
    const tagList = details.tags.map(t => '#' + t).join(' ');
    lines.push(`🏷️  Tags: ${tagList}`);
  }

  return lines;
}

function formatDetailsStatus(details: BackupDetails): string[] {
  const lines: string[] = [
    '',
    'Status:',
    `  • Backup file: ${details.backupExists ? '✅ exists' : '❌ missing'}`,
    `  • Original file: ${details.originalExists ? '✅ exists' : '⚠️  deleted/moved'}`,
  ];

  if (details.hashMatch !== undefined) {
    lines.push(`  • Content: ${details.hashMatch ? '✅ unchanged' : '⚠️  modified since backup'}`);
  }

  if (details.currentSize !== undefined && details.size !== details.currentSize) {
    lines.push(`  • Current size: ${formatFileSize(details.currentSize)} (was ${details.sizeFormatted})`);
  }

  return lines;
}

function formatDetailsHashes(details: BackupDetails): string[] {
  return details.fileHash ? [`  • Hash: ${details.fileHash}`] : [];
}

function formatDetailsRelated(details: BackupDetails): string[] {
  const lines: string[] = [];

  if (details.relatedFiles && details.relatedFiles.length > 0) {
    lines.push('', '🔗 Related Files:', ...details.relatedFiles.map(file => `   • ${file}`));
  }

  if (details.projectContext) {
    lines.push('', `📂 Project Context: ${details.projectContext}`);
  }

  if (details.author) {
    lines.push(`👤 Author: ${details.author}`);
  }

  if (details.warnings && details.warnings.length > 0) {
    lines.push('', '⚠️  Warnings:', ...details.warnings.map(w => `   • ${w}`));
  }

  return lines;
}

/** Formats backup details into a human-readable string. */
export function formatBackupDetails(details: BackupDetails): string {
  const lines: string[] = [
    ...formatDetailsHeader(details),
    ...formatDetailsStatus(details),
    ...formatDetailsHashes(details),
    ...formatDetailsRelated(details),
  ];

  return lines.join('\n');
}