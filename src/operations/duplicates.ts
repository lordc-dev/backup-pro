import { pathExists, readFile, stat } from '../utils/fs.js';
import { BackupStore } from '../utils/store.js';
import { BackupInfo, BackupMetadata } from '../types/index.js';
import { calculateFileHash } from '../utils/hashing.js';
import { formatFileSize } from '../utils/formatting.js';
import { parallelMap } from '../utils/concurrency.js';
import { validateMetadataPath } from '../utils/validate.js';
import { log } from '../utils/logger.js';

/** A group of backups with identical file content. */
export interface DuplicateGroup {
  hash: string;
  size: number;
  count: number;
  backups: BackupMetadata[];
  wastedSpace: number;
}

/** Result of finding duplicate backups across the store. */
export interface FindDuplicatesResult {
  duplicateGroups: DuplicateGroup[];
  totalDuplicates: number;
  totalWastedSpace: number;
  uniqueBackups: number;
}

async function computeBackupHash(backup: BackupInfo): Promise<{ hash: string; size: number } | null> {
  if (backup.metadata.fileHash && backup.metadata.size) {
    return { hash: backup.metadata.fileHash, size: backup.metadata.size };
  }
  try {
    validateMetadataPath(backup.backupPath, `backup ${backup.metadata.id}`);
    const content = await readFile(backup.backupPath);
    const hash = calculateFileHash(content);
    const stats = await stat(backup.backupPath);
    return { hash, size: stats.size };
  } catch (error) {
    log.debug('duplicates', `Failed to hash backup`, { path: backup.backupPath, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

async function computeBackupHashes(
  backups: BackupStore
): Promise<Map<string, { backup: BackupInfo; size: number }[]>> {
  const entries = [...backups.entries()];
  const results = await parallelMap(
    entries,
    async ([id, backup]) => {
      if (!(await pathExists(backup.backupPath))) return null;
      const result = await computeBackupHash(backup);
      if (!result) return null;
      return { id, hash: result.hash, size: result.size } as const;
    },
    5
  );

  const hashGroups = new Map<string, { backup: BackupInfo; size: number }[]>();
  for (const result of results) {
    if (result.status !== 'fulfilled' || result.value === null) continue;
    const { id, hash, size } = result.value;
    const backup = backups.get(id);
    if (!backup) continue;
    if (!hashGroups.has(hash)) {
      hashGroups.set(hash, []);
    }
    hashGroups.get(hash)!.push({ backup, size });
  }
  return hashGroups;
}

function buildDuplicateResults(
  hashGroups: Map<string, { backup: BackupInfo; size: number }[]>
): { duplicateGroups: DuplicateGroup[]; totalDuplicates: number; totalWastedSpace: number; uniqueBackups: number } {
  const duplicateGroups: DuplicateGroup[] = [];
  let totalDuplicates = 0;
  let totalWastedSpace = 0;
  let uniqueBackups = 0;

  for (const [hash, group] of hashGroups.entries()) {
    if (group.length > 1) {
      const size = group[0].size;
      const wastedSpace = size * (group.length - 1);
      duplicateGroups.push({
        hash, size, count: group.length,
        backups: group.map(g => g.backup.metadata), wastedSpace,
      });
      totalDuplicates += group.length - 1;
      totalWastedSpace += wastedSpace;
    }
    uniqueBackups += 1;
  }

  duplicateGroups.sort((a, b) => b.wastedSpace - a.wastedSpace);
  return { duplicateGroups, totalDuplicates, totalWastedSpace, uniqueBackups };
}

/** Finds backups with identical content by hashing, returning groups and wasted space. */
export async function findDuplicates(
  backups: BackupStore
): Promise<FindDuplicatesResult> {
  const hashGroups = await computeBackupHashes(backups);
  const { duplicateGroups, totalDuplicates, totalWastedSpace, uniqueBackups } = buildDuplicateResults(hashGroups);
  return { duplicateGroups, totalDuplicates, totalWastedSpace, uniqueBackups };
}

/** Formats duplicate analysis results into a human-readable string. */
export function formatDuplicatesResult(result: FindDuplicatesResult): string {
  if (result.duplicateGroups.length === 0) {
    return [
      '🔍 Duplicate Analysis',
      '═'.repeat(50),
      '',
      '✅ No duplicate backups found!',
      `📊 ${result.uniqueBackups} unique backups`,
    ].join('\n');
  }

  const lines: string[] = [
    '🔍 Duplicate Analysis',
    '═'.repeat(50),
    '',
    '📊 Summary:',
    `   • Unique backups: ${result.uniqueBackups}`,
    `   • Duplicate backups: ${result.totalDuplicates}`,
    `   • Wasted space: ${formatFileSize(result.totalWastedSpace)}`,
    '',
    `🔄 Duplicate Groups (${result.duplicateGroups.length}):`,
    '─'.repeat(50),
  ];

  for (const group of result.duplicateGroups.slice(0, 10)) {
    lines.push(
      '',
      `Hash: ${group.hash.substring(0, 8)}...`,
      `Size: ${formatFileSize(group.size)} × ${group.count} copies = ${formatFileSize(group.wastedSpace)} wasted`,
      'Files:',
      ...group.backups.map(backup =>
        `   • [${backup.id}] ${backup.originalPath} (${new Date(backup.timestamp).toLocaleDateString()})`,
      ),
    );
  }

  if (result.duplicateGroups.length > 10) {
    lines.push('', `... and ${result.duplicateGroups.length - 10} more groups`);
  }

  lines.push('', '💡 Tip: Use delete_backup to remove unwanted duplicates');

  return lines.join('\n');
}