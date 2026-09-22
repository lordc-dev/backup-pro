import { BackupMetadata, BackupInfo } from '../types/index.js';
import { BackupStore } from '../utils/store.js';
import * as path from 'node:path';

export type SortBy = 'date' | 'size' | 'name';
export type SortOrder = 'asc' | 'desc';

/** Returns all unique tags across all backups. */
export function getAllTags(backups: Map<string, BackupInfo>): string[] {
  const tagsSet = new Set<string>();
  for (const backup of backups.values()) {
    backup.metadata.tags?.forEach(tag => tagsSet.add(tag));
  }
  return Array.from(tagsSet).sort((a, b) => a.localeCompare(b));
}

/** Filters backups that have at least one of the given tags. */
export function filterByTags(
  backups: Map<string, BackupInfo>,
  tags: string[]
): Map<string, BackupInfo> {
  if (!tags || tags.length === 0) {
    return backups;
  }
  const filtered = new Map<string, BackupInfo>();
  for (const [id, backup] of backups.entries()) {
    if (backup.metadata.tags?.some(tag => tags.includes(tag))) {
      filtered.set(id, backup);
    }
  }
  return filtered;
}

/** Filters backups to those within the given date range. */
export function filterByDateRange(
  backups: Map<string, BackupInfo>,
  afterDate?: string,
  beforeDate?: string
): Map<string, BackupInfo> {
  const filtered = new Map<string, BackupInfo>();
  for (const [id, backup] of backups.entries()) {
    const backupDate = new Date(backup.metadata.timestamp);
    if (afterDate && backupDate < new Date(afterDate)) continue;
    if (beforeDate && backupDate > new Date(beforeDate)) continue;
    filtered.set(id, backup);
  }
  return filtered;
}

function matchesSearchTerm(backup: BackupInfo, term: string, searchIn: string[]): boolean {
  if (searchIn.includes('all') || searchIn.includes('description')) {
    if (backup.metadata.description?.toLowerCase().includes(term)) return true;
  }
  if (searchIn.includes('all') || searchIn.includes('tags')) {
    if (backup.metadata.tags?.some(tag => typeof tag === 'string' && tag.toLowerCase().includes(term))) return true;
  }
  if (searchIn.includes('all') || searchIn.includes('filename')) {
    if (backup.metadata.originalPath && path.basename(backup.metadata.originalPath).toLowerCase().includes(term)) return true;
  }
  return false;
}

/** Filters backups whose description/tags/filename contain the search term. */
export function searchBackups(
  backups: Map<string, BackupInfo>,
  searchTerm: string,
  searchIn: string[] = ['all']
): Map<string, BackupInfo> {
  const term = searchTerm.toLowerCase();
  const filtered = new Map<string, BackupInfo>();
  for (const [id, backup] of backups.entries()) {
    if (matchesSearchTerm(backup, term, searchIn)) {
      filtered.set(id, backup);
    }
  }
  return filtered;
}

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
    filtered = searchBackups(filtered, searchTerm, (searchIn ?? ['all']));
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

  // Pre-compute timestamps once — avoids Date parsing inside the sort comparator.
  const times = new Map<BackupMetadata, number>();
  for (const meta of list) {
    times.set(meta, new Date(meta.timestamp).getTime());
  }

  list.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'date':
        comparison = times.get(b)! - times.get(a)!;
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