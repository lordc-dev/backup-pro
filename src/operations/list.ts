import { ListBackupsParams, BackupMetadata } from '../types/index.js';
import { BackupStore } from '../utils/store.js';
import { applyFiltersAndSort } from './filter-utils.js';

/** Lists backups with optional filtering by file path, tags, date range, and search term. */
export function listBackups(
  params: ListBackupsParams,
  backups: BackupStore
): BackupMetadata[] {
  return applyFiltersAndSort(backups, {
    filePath: params.filePath,
    tags: params.tags,
    afterDate: params.afterDate,
    beforeDate: params.beforeDate,
    searchTerm: params.searchTerm,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    limit: params.limit,
  });
}