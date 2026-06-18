import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { CleanupBackupsParams, CleanupResult, BackupInfo } from '../types/index.js';
import { BackupStore } from '../utils/store.js';
import { log } from '../utils/logger.js';
import { pathExists, remove, stat } from '../utils/fs.js';
import { validateMetadataPath } from '../utils/validate.js';

function parseOlderThan(olderThan: string): Date {
  const match = new RegExp(/^(\d+)([dhm])$/).exec(olderThan);
  if (!match) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid olderThan format: '${olderThan}'. Use format like '7d', '24h', or '30m'.`);
  }

  const amount = Number.parseInt(match[1]);
  const unit = match[2];
  const cutoffDate = new Date();

  switch (unit) {
    case 'd':
      cutoffDate.setDate(cutoffDate.getDate() - amount);
      break;
    case 'h':
      cutoffDate.setHours(cutoffDate.getHours() - amount);
      break;
    case 'm':
      cutoffDate.setMinutes(cutoffDate.getMinutes() - amount);
      break;
  }

  return cutoffDate;
}

function isExcludedByTag(backup: BackupInfo, excludeTags: string[]): boolean {
  return excludeTags.length > 0 && backup.metadata.tags.some(tag => excludeTags.includes(tag));
}

function groupBackupsByFile(
  backups: BackupStore,
  filePath: string | undefined,
  excludeTags: string[],
  keptBackups: BackupInfo[]
): Map<string, BackupInfo[]> {
  const groupedByFile = new Map<string, BackupInfo[]>();

  for (const [_id, backup] of backups.entries()) {
    if (filePath && backup.metadata.originalPath !== filePath) {
      keptBackups.push(backup);
      continue;
    }
    if (isExcludedByTag(backup, excludeTags)) {
      keptBackups.push(backup);
      continue;
    }

    const key = backup.metadata.originalPath;
    if (!groupedByFile.has(key)) {
      groupedByFile.set(key, []);
    }
    groupedByFile.get(key)!.push(backup);
  }

  return groupedByFile;
}

function shouldDeleteBackup(
  backup: BackupInfo,
  index: number,
  keepLast: number | undefined,
  olderThan: string | undefined
): boolean {
  if (keepLast !== undefined && index >= keepLast) return true;
  if (olderThan && shouldDeleteByAge(backup, olderThan)) return true;
  return false;
}

function shouldDeleteByAge(backup: BackupInfo, olderThan: string): boolean {
  const cutoffDate = parseOlderThan(olderThan);
  return new Date(backup.metadata.timestamp) < cutoffDate;
}

async function computeFreedSpace(backup: BackupInfo): Promise<number> {
  if (!(await pathExists(backup.backupPath))) return 0;
  try {
    const stats = await stat(backup.backupPath);
    return stats.size;
  } catch (error) {
    log.debug('cleanup', 'Failed to stat backup file for size', { path: backup.backupPath, error: error instanceof Error ? error.message : String(error) });
    return 0;
  }
}

async function classifyBackups(
  groupedByFile: Map<string, BackupInfo[]>,
  keepLast: number | undefined,
  olderThan: string | undefined,
  keptBackups: BackupInfo[]
): Promise<{ deletedBackups: BackupInfo[]; freedSpace: number }> {
  const deletedBackups: BackupInfo[] = [];
  let freedSpace = 0;

  for (const [_file, fileBackups] of groupedByFile.entries()) {
    fileBackups.sort((a, b) =>
      new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime()
    );

    for (let i = 0; i < fileBackups.length; i++) {
      const backup = fileBackups[i];
      if (shouldDeleteBackup(backup, i, keepLast, olderThan)) {
        deletedBackups.push(backup);
        freedSpace += await computeFreedSpace(backup);
      } else {
        keptBackups.push(backup);
      }
    }
  }

  return { deletedBackups, freedSpace };
}

async function deleteBackupFiles(deletedBackups: BackupInfo[], backups: BackupStore): Promise<void> {
  for (const backup of deletedBackups) {
    backups.delete(backup.metadata.id);
    try {
      validateMetadataPath(backup.backupPath, `backup ${backup.metadata.id}`);
      if (await pathExists(backup.backupPath)) {
        await remove(backup.backupPath);
      }
    } catch (error) {
      log.error('cleanup', `Error deleting file ${backup.backupPath}`, { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

/** Removes old or excessive backups based on age, count, or file path, with optional dry-run. */
export async function cleanupBackups(
  params: CleanupBackupsParams,
  backups: BackupStore
): Promise<CleanupResult> {
  const { keepLast, olderThan, filePath, dryRun = false, excludeTags = [] } = params;

  if (keepLast === undefined && !olderThan && !filePath) {
    throw new McpError(ErrorCode.InvalidParams, 'At least one of keepLast, olderThan, or filePath must be specified');
  }

  if (olderThan) {
    parseOlderThan(olderThan);
  }

  const keptBackups: BackupInfo[] = [];
  const groupedByFile = groupBackupsByFile(backups, filePath, excludeTags, keptBackups);
  const { deletedBackups, freedSpace } = await classifyBackups(groupedByFile, keepLast, olderThan, keptBackups);

  if (!dryRun) {
    await deleteBackupFiles(deletedBackups, backups);
  }

  return {
    deletedCount: deletedBackups.length,
    freedSpace,
    deletedBackups: deletedBackups.map(b => b.metadata),
    keptBackups: keptBackups.map(b => b.metadata),
  };
}