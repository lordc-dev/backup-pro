import { SearchBackupsParams, BackupMetadata } from '../types/index.js';
import { BackupStore } from '../utils/store.js';
import { applyFiltersAndSort } from './filter-utils.js';

/** Searches backups by query string, with optional tag and date range filters. */
export function searchBackups(
  params: SearchBackupsParams,
  backups: BackupStore
): BackupMetadata[] {
  return applyFiltersAndSort(backups, {
    searchTerm: params.query,
    searchIn: params.searchIn,
    tags: params.tags,
    dateRange: params.dateRange,
    sortBy: 'date',
    sortOrder: 'desc',
    limit: params.limit,
  });
}