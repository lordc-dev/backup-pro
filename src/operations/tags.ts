import { BackupStore } from '../utils/store.js';
import { getAllTags as getAllTagsUtil } from '../utils/persistence.js';

/** Returns all unique tags across all backups. */
export function getTags(backups: BackupStore): string[] {
  return getAllTagsUtil(backups);
}

/** Returns tag usage counts, sorted by frequency descending. */
export function getTagStats(backups: BackupStore): { tag: string; count: number }[] {
  const tagCounts = new Map<string, number>();

  for (const backup of backups.values()) {
    if (backup.metadata.tags) {
      for (const tag of backup.metadata.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  }

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/** Adds tags to a backup. Returns true if the backup was found and updated. */
export function addTagsToBackup(
  backupId: string,
  tags: string[],
  backups: BackupStore
): boolean {
  const backup = backups.get(backupId);
  if (!backup) {
    return false;
  }

  const existingTags = new Set(backup.metadata.tags);
  for (const tag of tags) {
    existingTags.add(tag);
  }

  backup.metadata.tags = Array.from(existingTags);
  backups.set(backupId, backup);

  return true;
}

/** Removes tags from a backup. Returns true if the backup was found and updated. */
export function removeTagsFromBackup(
  backupId: string,
  tags: string[],
  backups: BackupStore
): boolean {
  const backup = backups.get(backupId);
  if (!backup) {
    return false;
  }

  backup.metadata.tags = backup.metadata.tags.filter(tag => !tags.includes(tag));
  backups.set(backupId, backup);

  return true;
}