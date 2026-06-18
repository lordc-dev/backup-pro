import { BackupStats } from '../types/index.js';
import { BackupStore } from '../utils/store.js';
import { pathExists, stat } from '../utils/fs.js';
import { parallelMap } from '../utils/concurrency.js';
import { config } from '../utils/config.js';
import { getTagStats } from './tags.js';

/** Backup statistics including totals, size, and top tags. */
export interface StatsResult {
  stats: BackupStats;
  warnings: string[];
}

/** Computes the size of a backup, using metadata size when available, falling back to filesystem stat. */
async function computeFileStats(backup: import('../types/index.js').BackupInfo): Promise<{ size: number; warning?: string }> {
  if (backup.metadata.size) {
    return { size: backup.metadata.size };
  }
  if (!(await pathExists(backup.backupPath))) {
    return { size: 0 };
  }
  try {
    const stats = await stat(backup.backupPath);
    return { size: stats.size };
  } catch (error) {
    return {
      size: 0,
      warning: `Failed to stat ${backup.metadata.id}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Processes a single backup's stat result, accumulating into totals. */
function processBackupStat(
  backup: import('../types/index.js').BackupInfo,
  result: PromiseSettledResult<{ size: number; warning?: string }>,
  totals: { totalSize: number; uniqueFiles: Set<string>; warnings: string[] },
): void {
  totals.uniqueFiles.add(backup.metadata.originalPath);

  if (result.status === 'fulfilled') {
    totals.totalSize += result.value.size;
    if (result.value.warning) totals.warnings.push(result.value.warning);
  } else {
    totals.warnings.push(`Failed to stat ${backup.metadata.id}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
  }
}

/** Updates the oldest/newest timestamp range with a new timestamp. */
function updateTimestampRange(
  timestamp: string,
  range: { oldest?: string; newest?: string },
): void {
  if (!range.oldest || timestamp < range.oldest) {
    range.oldest = timestamp;
  }
  if (!range.newest || timestamp > range.newest) {
    range.newest = timestamp;
  }
}

/** Computes aggregate statistics for all backups in the store. */
export async function getBackupStats(backups: BackupStore): Promise<StatsResult> {
  const warnings: string[] = [];

  if (backups.loadError) {
    warnings.push(`Metadata load issue: ${backups.loadError}`);
  }

  const allBackups = [...backups.values()];
  const statResults = await parallelMap(
    allBackups,
    (backup) => computeFileStats(backup),
    config.batchConcurrency,
  );

  const totals = { totalSize: 0, uniqueFiles: new Set<string>(), warnings };
  const timestampRange = { oldest: undefined as string | undefined, newest: undefined as string | undefined };

  for (let i = 0; i < allBackups.length; i++) {
    processBackupStat(allBackups[i], statResults[i], totals);
    updateTimestampRange(allBackups[i].metadata.timestamp, timestampRange);
  }

  const topTags = getTagStats(backups);

  return {
    stats: {
      totalBackups: backups.size,
      totalSize: totals.totalSize,
      fileCount: totals.uniqueFiles.size,
      oldestBackup: timestampRange.oldest,
      newestBackup: timestampRange.newest,
      topTags: topTags.slice(0, 10),
      averageBackupSize: backups.size > 0 ? Math.round(totals.totalSize / backups.size) : 0,
    },
    warnings,
  };
}