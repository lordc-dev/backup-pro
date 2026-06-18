import { BackupMetadata, BackupInfo } from '../types/index.js';
import { BackupStore } from '../utils/store.js';
import { filterByTags, filterByDateRange, searchBackups as searchBackupsUtil } from '../utils/persistence.js';

export type SortBy = 'date' | 'size' | 'name';
export type SortOrder = 'asc' | 'desc';

export interface FilterAndSortOptions {
  filePath?: string;
  tags?: string[];
  afterDate?: string;
  beforeDate?: string;
  searchTerm?: string;
  searchIn?: string[];
  dateRange?: { start?: string; end?: string };
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  limit?: number;
}

/** Applies tag/date/search filters to a BackupStore and returns sorted metadata.
 *  Shared by listBackups and searchBackups to keep filter+sort logic in one place. */
export function applyFiltersAndSort(
  backups: BackupStore,
  opts: FilterAndSortOptions
): BackupMetadata[] {
  const {
    filePath,
    tags = [],
    afterDate,
    beforeDate,
    searchTerm,
    searchIn,
    dateRange,
    sortBy = 'date',
    sortOrder = 'desc',
    limit,
  } = opts;

  let filtered: Map<string, BackupInfo> = new Map(
    [...backups.entries()].filter(([, info]) => !filePath || info.metadata.originalPath === filePath)
  );

  if (searchTerm) {
    filtered = searchBackupsUtil(filtered, searchTerm, (searchIn ?? ['all']));
  }

  if (tags.length > 0) {
    filtered = filterByTags(filtered, tags);
  }

  const effectiveAfter = afterDate ?? dateRange?.start;
  const effectiveBefore = beforeDate ?? dateRange?.end;
  if (effectiveAfter || effectiveBefore) {
    filtered = filterByDateRange(filtered, effectiveAfter, effectiveBefore);
  }

  const list: BackupMetadata[] = [];
  for (const [, info] of filtered.entries()) {
    list.push(info.metadata);
  }

  list.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'date':
        comparison = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        break;
      case 'size':
        comparison = (b.size || 0) - (a.size || 0);
        break;
      case 'name':
        comparison = a.originalPath.localeCompare(b.originalPath);
        break;
    }
    return sortOrder === 'desc' ? comparison : -comparison;
  });

  return typeof limit === 'number' ? list.slice(0, limit) : list;
}