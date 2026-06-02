import * as path from 'node:path';
import { readJSON, writeJSON, pathExists, ensureDir } from './fs.js';
import { BackupInfo } from '../types/index.js';
import { BACKUP_DIR } from './constants.js';
import { CURRENT_SCHEMA_VERSION } from '../types/index.js';
import { log } from './logger.js';

const METADATA_FILE = path.join(BACKUP_DIR, 'metadata.json');

interface StoredMetadata {
  schemaVersion?: number;
  backups?: Record<string, BackupInfo>;
}

function migrateMetadata(data: StoredMetadata): Map<string, BackupInfo> {
  const version = data.schemaVersion ?? 1;
  const migrated = new Map<string, BackupInfo>(Object.entries(data.backups ?? {}));

  if (version < 2) {
    log.info('persistence', `Migrating metadata from schema v${version} to v${CURRENT_SCHEMA_VERSION}`);
  }

  return migrated;
}

export async function loadBackupMetadata(): Promise<Map<string, BackupInfo>> {
  try {
    if (!(await pathExists(METADATA_FILE))) {
      return new Map();
    }
    
    const data: StoredMetadata = await readJSON(METADATA_FILE);
    if (data.backups) {
      return migrateMetadata(data);
    }
    
    // Legacy format: flat object without schemaVersion
    const legacy = data as unknown as Record<string, BackupInfo>;
    return migrateMetadata({ backups: legacy });
  } catch (error) {
    log.error('persistence', 'Error loading backup metadata', { error: error instanceof Error ? error.message : String(error) });
    return new Map();
  }
}

export async function saveBackupMetadata(backups: Map<string, BackupInfo>): Promise<void> {
  try {
    const dir = path.dirname(METADATA_FILE);
    await ensureDir(dir);
    
    const data: StoredMetadata = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      backups: Object.fromEntries(backups),
    };
    await writeJSON(METADATA_FILE, data, { spaces: 2 });
  } catch (error) {
    log.error('persistence', 'Error saving backup metadata', { error: error instanceof Error ? error.message : String(error) });
  }
}

export function getAllTags(backups: Map<string, BackupInfo>): string[] {
  const tagsSet = new Set<string>();
  
  for (const backup of backups.values()) {
    if (backup.metadata.tags) {
      backup.metadata.tags.forEach(tag => tagsSet.add(tag));
    }
  }
  
  return Array.from(tagsSet).sort();
}

export function filterByTags(
  backups: Map<string, BackupInfo>,
  tags: string[]
): Map<string, BackupInfo> {
  if (!tags || tags.length === 0) {
    return backups;
  }
  
  const filtered = new Map<string, BackupInfo>();
  
  for (const [id, backup] of backups.entries()) {
    if (backup.metadata.tags && backup.metadata.tags.some(tag => tags.includes(tag))) {
      filtered.set(id, backup);
    }
  }
  
  return filtered;
}

export function filterByDateRange(
  backups: Map<string, BackupInfo>,
  afterDate?: string,
  beforeDate?: string
): Map<string, BackupInfo> {
  const filtered = new Map<string, BackupInfo>();
  
  for (const [id, backup] of backups.entries()) {
    const backupDate = new Date(backup.metadata.timestamp);
    
    if (afterDate && backupDate < new Date(afterDate)) {
      continue;
    }
    
    if (beforeDate && backupDate > new Date(beforeDate)) {
      continue;
    }
    
    filtered.set(id, backup);
  }
  
  return filtered;
}

export function searchBackups(
  backups: Map<string, BackupInfo>,
  searchTerm: string,
  searchIn: string[] = ['all']
): Map<string, BackupInfo> {
  const term = searchTerm.toLowerCase();
  const filtered = new Map<string, BackupInfo>();
  
  for (const [id, backup] of backups.entries()) {
    let match = false;
    
    if (searchIn.includes('all') || searchIn.includes('description')) {
      if (backup.metadata.description?.toLowerCase().includes(term)) {
        match = true;
      }
    }

    if (searchIn.includes('all') || searchIn.includes('tags')) {
      if (backup.metadata.tags && backup.metadata.tags.some(tag => typeof tag === 'string' && tag.toLowerCase().includes(term))) {
        match = true;
      }
    }

    if (searchIn.includes('all') || searchIn.includes('filename')) {
      if (backup.metadata.originalPath && path.basename(backup.metadata.originalPath).toLowerCase().includes(term)) {
        match = true;
      }
    }
    
    if (match) {
      filtered.set(id, backup);
    }
  }
  
  return filtered;
}