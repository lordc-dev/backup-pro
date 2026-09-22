/**
 * Type definitions for the enhanced backup server
 */

export const CURRENT_SCHEMA_VERSION = 2;

export interface BackupInfo {
  backupPath: string;
  metadata: BackupMetadata;
}

export interface BackupMetadata {
  id: string;
  originalPath: string;
  timestamp: string;
  description: string;
  size?: number;
  tags: string[];
  fileHash?: string;
  relatedFiles?: string[];
  author?: string;
  projectContext?: string;
}

export interface CreateBackupParams {
  filePath: string;
  description?: string;
  tags?: string[];
  relatedFiles?: string[];
  projectContext?: string;
}

export interface RestoreBackupParams {
  backupId: string;
  /** Optional: restore to a different location instead of original path */
  targetPath?: string;
}

export interface ListBackupsParams {
  filePath?: string;
  tags?: string[];
  afterDate?: string;
  beforeDate?: string;
  searchTerm?: string;
  limit?: number;
  sortBy?: 'date' | 'size' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchBackupsParams {
  query: string;
  searchIn?: ('description' | 'tags' | 'filename' | 'all')[];
  tags?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  limit?: number;
}

export interface CleanupBackupsParams {
  keepLast?: number;
  olderThan?: string;
  filePath?: string;
  dryRun?: boolean;
  excludeTags?: string[];
}

export interface BatchBackupParams {
  filePaths: string[];
  description?: string;
  tags?: string[];
  projectContext?: string;
}

export interface CreateBackupResult {
  backupId: string;
  backupPath: string;
  warnings?: string[];
}

export interface BackupResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface BackupStats {
  totalBackups: number;
  totalSize: number;
  fileCount: number;
  oldestBackup?: string;
  newestBackup?: string;
  topTags: { tag: string; count: number }[];
  averageBackupSize: number;
}

export interface CleanupResult {
  deletedCount: number;
  freedSpace: number;
  deletedBackups: BackupMetadata[];
  keptBackups: BackupMetadata[];
}

