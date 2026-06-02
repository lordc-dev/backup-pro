import { SearchBackupsParams, BackupMetadata } from '../types/index.js';
import { BackupStore } from '../utils/store.js';
import { searchBackups as searchBackupsUtil, filterByTags, filterByDateRange } from '../utils/persistence.js';

/** Searches backups by query string, with optional tag and date range filters. */
export function searchBackups(
  params: SearchBackupsParams,
  backups: BackupStore
): BackupMetadata[] {
  const { 
    query, 
    searchIn = ['all'], 
    tags = [],
    dateRange,
    limit = 50
  } = params;

  let filtered = searchBackupsUtil(backups, query, searchIn);

  if (tags.length > 0) {
    filtered = filterByTags(filtered, tags);
  }

  if (dateRange) {
    filtered = filterByDateRange(filtered, dateRange.start, dateRange.end);
  }

  const results: BackupMetadata[] = [];
  for (const [_id, backup] of filtered.entries()) {
    results.push(backup.metadata);
  }

  results.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return results.slice(0, limit);
}