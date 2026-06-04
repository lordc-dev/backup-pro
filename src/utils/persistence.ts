import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import { createHmac, randomBytes } from 'node:crypto';
import { readJSON, writeJSON, pathExists, ensureDir } from './fs.js';
import { BackupInfo } from '../types/index.js';
import { BACKUP_DIR } from './constants.js';
import { CURRENT_SCHEMA_VERSION } from '../types/index.js';
import { log } from './logger.js';

const METADATA_FILE = path.join(BACKUP_DIR, 'metadata.json');
const METADATA_KEYS_FILE = path.join(os.homedir(), '.config', 'backup-pro', '.metadata-key');

/** Generates or loads a persistent HMAC key for metadata integrity. */
async function getIntegrityKey(): Promise<string> {
  if (await pathExists(METADATA_KEYS_FILE)) {
    const key = await readJSON(METADATA_KEYS_FILE) as { key: string };
    if (key?.key) return key.key;
  }
  const key = randomBytes(32).toString('hex');
  await ensureDir(path.dirname(METADATA_KEYS_FILE));
  await writeJSON(METADATA_KEYS_FILE, { key }, { spaces: 0 });
  // SECURITY: Restrict key file permissions to owner-only to prevent metadata tampering
  await fs.chmod(METADATA_KEYS_FILE, 0o600);
  return key;
}

/** Computes an HMAC-SHA256 of the backup entries for integrity verification. */
function computeMetadataHmac(entries: Record<string, BackupInfo>, key: string): string {
  const data = JSON.stringify(entries, Object.keys(entries).sort());
  return createHmac('sha256', key).update(data).digest('hex');
}

interface StoredMetadata {
  schemaVersion?: number;
  backups?: Record<string, BackupInfo>;
  integrity?: string;
}

function migrateMetadata(data: StoredMetadata): Map<string, BackupInfo> {
  const version = data.schemaVersion ?? 1;
  const migrated = new Map<string, BackupInfo>(Object.entries(data.backups ?? {}));

  if (version < 2) {
    log.info('persistence', `Migrating metadata from schema v${version} to v${CURRENT_SCHEMA_VERSION}`);
  }

  return migrated;
}

export async function loadBackupMetadata(): Promise<{ backups: Map<string, BackupInfo>; integrityWarning?: string }> {
  try {
    if (!(await pathExists(METADATA_FILE))) {
      return { backups: new Map() };
    }
    
    const data: StoredMetadata = await readJSON(METADATA_FILE);
    const entries = data.backups ?? (data as unknown as Record<string, BackupInfo>);
    const backups = migrateMetadata({ backups: entries });

    if (data.integrity) {
      try {
        const key = await getIntegrityKey();
        const expected = computeMetadataHmac(entries, key);
        if (expected !== data.integrity) {
          log.warn('persistence', 'Metadata integrity check failed — metadata may have been tampered with');
          return { backups, integrityWarning: 'Metadata integrity check failed. Backup paths should be re-validated.' };
        }
      } catch {
        log.warn('persistence', 'Could not verify metadata integrity (HMAC key missing or unreadable)');
      }
    }
    
    return { backups };
  } catch (error) {
    log.error('persistence', 'Error loading backup metadata', { error: error instanceof Error ? error.message : String(error) });
    return { backups: new Map() };
  }
}

export async function saveBackupMetadata(backups: Map<string, BackupInfo>): Promise<void> {
  try {
    const dir = path.dirname(METADATA_FILE);
    await ensureDir(dir);
    
    const entries = Object.fromEntries(backups);
    const key = await getIntegrityKey();
    const integrity = computeMetadataHmac(entries, key);

    const data: StoredMetadata = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      backups: entries,
      integrity,
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
