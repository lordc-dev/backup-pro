import { ListBackupsParams, BackupMetadata, BackupInfo } from '../types/index.js';
import { BackupStore } from '../utils/store.js';
import { filterByTags, filterByDateRange, searchBackups as searchBackupsUtil } from '../utils/persistence.js';

/** Lists backups with optional filtering by file path, tags, date range, and search term. */
export function listBackups(
  params: ListBackupsParams,
  backups: BackupStore
): BackupMetadata[] {
  const { 
    filePath, 
    tags = [],
    afterDate,
    beforeDate,
    searchTerm,
    limit = 100,
    sortBy = 'date',
    sortOrder = 'desc'
  } = params;

  let filtered: Map<string, BackupInfo> = new Map(
    [...backups.entries()].filter(([, info]) => !filePath || info.metadata.originalPath === filePath)
  );

  if (tags.length > 0) {
    filtered = filterByTags(filtered, tags);
  }

  if (afterDate || beforeDate) {
    filtered = filterByDateRange(filtered, afterDate, beforeDate);
  }

  if (searchTerm) {
    filtered = searchBackupsUtil(filtered, searchTerm, ['all']);
  }

  const backupList: BackupMetadata[] = [];
  for (const [_id, info] of filtered.entries()) {
    backupList.push(info.metadata);
  }

  backupList.sort((a, b) => {
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

  return backupList.slice(0, limit);
}