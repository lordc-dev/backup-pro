import { BackupStats } from '../types/index.js';
import { BackupStore } from '../utils/store.js';
import { pathExists, stat } from '../utils/fs.js';
import { getTagStats } from './tags.js';

/** Backup statistics including totals, size, and top tags. */
export interface StatsResult {
  stats: BackupStats;
  warnings: string[];
}

async function computeFileStats(backup: import('../types/index.js').BackupInfo): Promise<{ size: number; warning?: string }> {
  if (backup.metadata.size) {
    return { size: backup.metadata.size };
  }

  if (await pathExists(backup.backupPath)) {
    try {
      const stats = await stat(backup.backupPath);
      return { size: stats.size };
    } catch (error) {
      return { 
        size: 0, 
        warning: `Failed to stat ${backup.metadata.id}: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  return { size: 0 };
}

/** Computes aggregate statistics for all backups in the store. */
export async function getBackupStats(backups: BackupStore): Promise<StatsResult> {
  let totalSize = 0;
  let oldestTimestamp: string | undefined;
  let newestTimestamp: string | undefined;
  const uniqueFiles = new Set<string>();
  const warnings: string[] = [];

  if (backups.loadError) {
    warnings.push(`Metadata load issue: ${backups.loadError}`);
  }

  for (const backup of backups.values()) {
    uniqueFiles.add(backup.metadata.originalPath);

    const { size, warning } = await computeFileStats(backup);
    totalSize += size;
    if (warning) warnings.push(warning);

    if (!oldestTimestamp || backup.metadata.timestamp < oldestTimestamp) {
      oldestTimestamp = backup.metadata.timestamp;
    }
    if (!newestTimestamp || backup.metadata.timestamp > newestTimestamp) {
      newestTimestamp = backup.metadata.timestamp;
    }
  }

  const topTags = getTagStats(backups);

  return {
    stats: {
      totalBackups: backups.size,
      totalSize: totalSize,
      fileCount: uniqueFiles.size,
      oldestBackup: oldestTimestamp,
      newestBackup: newestTimestamp,
      topTags: topTags.slice(0, 10),
      averageBackupSize: backups.size > 0 ? Math.round(totalSize / backups.size) : 0
    },
    warnings,
  };
}