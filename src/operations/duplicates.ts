import { pathExists, readFile, stat } from '../utils/fs.js';
import { BackupStore } from '../utils/store.js';
import { BackupInfo, BackupMetadata } from '../types/index.js';
import { calculateFileHash } from '../utils/hashing.js';
import { formatFileSize } from '../utils/formatting.js';

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

/** Finds backups with identical content by hashing, returning groups and wasted space. */
export async function findDuplicates(
  backups: BackupStore
): Promise<FindDuplicatesResult> {
  const hashGroups = new Map<string, { backup: BackupInfo; size: number }[]>();
  const warnings: string[] = [];

  for (const [id, backup] of backups.entries()) {
    if (!(await pathExists(backup.backupPath))) {
      continue;
    }

    let hash: string;
    let size: number;

    if (backup.metadata.fileHash && backup.metadata.size) {
      hash = backup.metadata.fileHash;
      size = backup.metadata.size;
    } else {
      try {
        const content = await readFile(backup.backupPath);
        hash = calculateFileHash(content);
        const stats = await stat(backup.backupPath);
        size = stats.size;
      } catch (error) {
        warnings.push(`Failed to read backup ${id}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
    }

    if (!hashGroups.has(hash)) {
      hashGroups.set(hash, []);
    }
    hashGroups.get(hash)!.push({ backup, size });
  }

  const duplicateGroups: DuplicateGroup[] = [];
  let totalDuplicates = 0;
  let totalWastedSpace = 0;
  let uniqueBackups = 0;

  for (const [hash, group] of hashGroups.entries()) {
    if (group.length > 1) {
      const size = group[0].size;
      const wastedSpace = size * (group.length - 1);
      
      duplicateGroups.push({
        hash,
        size,
        count: group.length,
        backups: group.map(g => g.backup.metadata),
        wastedSpace
      });

      totalDuplicates += group.length - 1;
      totalWastedSpace += wastedSpace;
      uniqueBackups += 1;
    } else {
      uniqueBackups += 1;
    }
  }

  duplicateGroups.sort((a, b) => b.wastedSpace - a.wastedSpace);

  return {
    duplicateGroups,
    totalDuplicates,
    totalWastedSpace,
    uniqueBackups
  };
}

/** Formats duplicate analysis results into a human-readable string. */
export function formatDuplicatesResult(result: FindDuplicatesResult): string {
  const lines: string[] = [];

  lines.push(`🔍 Duplicate Analysis`);
  lines.push('═'.repeat(50));
  lines.push('');

  if (result.duplicateGroups.length === 0) {
    lines.push('✅ No duplicate backups found!');
    lines.push(`📊 ${result.uniqueBackups} unique backups`);
    return lines.join('\n');
  }

  lines.push(`📊 Summary:`);
  lines.push(`   • Unique backups: ${result.uniqueBackups}`);
  lines.push(`   • Duplicate backups: ${result.totalDuplicates}`);
  lines.push(`   • Wasted space: ${formatFileSize(result.totalWastedSpace)}`);
  lines.push('');
  lines.push(`🔄 Duplicate Groups (${result.duplicateGroups.length}):`);
  lines.push('─'.repeat(50));

  for (const group of result.duplicateGroups.slice(0, 10)) {
    lines.push('');
    lines.push(`Hash: ${group.hash.substring(0, 8)}...`);
    lines.push(`Size: ${formatFileSize(group.size)} × ${group.count} copies = ${formatFileSize(group.wastedSpace)} wasted`);
    lines.push('Files:');
    
    for (const backup of group.backups) {
      const date = new Date(backup.timestamp).toLocaleDateString();
      lines.push(`   • [${backup.id}] ${backup.originalPath} (${date})`);
    }
  }

  if (result.duplicateGroups.length > 10) {
    lines.push('');
    lines.push(`... and ${result.duplicateGroups.length - 10} more groups`);
  }

  lines.push('');
  lines.push('💡 Tip: Use delete_backup to remove unwanted duplicates');

  return lines.join('\n');
}