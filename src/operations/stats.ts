import { BackupStats } from '../types/index.js';
import { BackupStore } from '../utils/store.js';
import { pathExists, stat } from '../utils/fs.js';
import { getTagStats } from './tags.js';

/** Backup statistics including totals, size, and top tags. */
export interface StatsResult {
  stats: BackupStats;
  warnings: string[];
}

/** Computes aggregate statistics for all backups in the store. */
export async function getBackupStats(backups: BackupStore): Promise<StatsResult> {
  let totalSize = 0;
  let oldestTimestamp: string | undefined;
  let newestTimestamp: string | undefined;
  const uniqueFiles = new Set<string>();
  const warnings: string[] = [];

  for (const backup of backups.values()) {
    uniqueFiles.add(backup.metadata.originalPath);

    if (backup.metadata.size) {
      totalSize += backup.metadata.size;
    } else if (await pathExists(backup.backupPath)) {
      try {
        const stats = await stat(backup.backupPath);
        totalSize += stats.size;
      } catch (error) {
        warnings.push(`Failed to stat ${backup.metadata.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

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