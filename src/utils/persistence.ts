import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import { createHmac, randomBytes } from 'node:crypto';
import { readJSON, writeJSON, pathExists, ensureDir } from './fs.js';
import { BackupInfo, CURRENT_SCHEMA_VERSION } from '../types/index.js';
import { config } from './config.js';
import { log } from './logger.js';

function getMetadataFile(): string {
  return path.join(config.backupDir, 'metadata.json');
}
const METADATA_KEYS_FILE = path.join(os.homedir(), '.config', 'backup-pro', '.metadata-key');

/** Generates or loads a persistent HMAC key for metadata integrity. */
async function getIntegrityKey(): Promise<string> {
  if (await pathExists(METADATA_KEYS_FILE)) {
    const stored = await readJSON<{ key: string }>(METADATA_KEYS_FILE);
    if (stored?.key) return stored.key;
  }
  const key = randomBytes(32).toString('hex');
  await ensureDir(path.dirname(METADATA_KEYS_FILE));
  await writeJSON(METADATA_KEYS_FILE, { key }, { spaces: 0 });
  // SECURITY: Restrict key file permissions to owner-only to prevent metadata tampering
  await fs.chmod(METADATA_KEYS_FILE, 0o600);
  return key;
}

/** Computes an HMAC-SHA256 of the backup entries for integrity verification.
 *  Serializes with top-level keys in sorted order for determinism. */
function computeMetadataHmac(entries: Record<string, BackupInfo>, key: string): string {
  const sortedKeys = Object.keys(entries).sort((a, b) => a.localeCompare(b));
  const ordered: Record<string, BackupInfo> = {};
  for (const k of sortedKeys) ordered[k] = entries[k];
  return createHmac('sha256', key).update(JSON.stringify(ordered)).digest('hex');
}

interface StoredMetadata {
  schemaVersion?: number;
  backups?: Record<string, BackupInfo>;
  integrity?: string;
}

function migrateMetadata(data: StoredMetadata): Map<string, BackupInfo> {
  const version = data.schemaVersion ?? 1;
  const migrated = new Map<string, BackupInfo>(Object.entries(data.backups ?? {}));

  if (version < CURRENT_SCHEMA_VERSION) {
    log.info('persistence', `Migrating metadata from schema v${version} to v${CURRENT_SCHEMA_VERSION}`);
  }

  return migrated;
}

export async function loadBackupMetadata(): Promise<{ backups: Map<string, BackupInfo>; integrityWarning?: string; loadError?: string }> {
  try {
    if (!(await pathExists(getMetadataFile()))) {
      return { backups: new Map() };
    }
    
    const data: StoredMetadata = await readJSON(getMetadataFile());
    // Legacy v1 format: the file IS a flat record of BackupMetadata (no wrapper).
    // Wrap each entry into BackupInfo so the store shape is consistent.
    const entries: Record<string, BackupInfo> = data.backups ?? Object.fromEntries(
      Object.entries(data as unknown as Record<string, BackupInfo['metadata']>).map(([id, meta]) => [
        id,
        { backupPath: path.join(config.backupDir, `${meta.originalPath?.split('/').pop() ?? id}.${id}.backup`), metadata: meta },
      ])
    );
    const backups = migrateMetadata({ ...data, backups: entries });

    if (data.integrity) {
      try {
        const key = await getIntegrityKey();
        const expected = computeMetadataHmac(entries, key);
        if (expected !== data.integrity) {
          log.warn('persistence', 'Metadata integrity check failed — metadata may have been tampered with');
          return { backups, integrityWarning: 'Metadata integrity check failed. Backup paths should be re-validated.' };
        }
      } catch (error) {
        log.debug('persistence', 'HMAC integrity check failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    return { backups };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('persistence', 'Error loading backup metadata', { error: message });
    return { backups: new Map(), loadError: message };
  }
}

export async function saveBackupMetadata(backups: Map<string, BackupInfo>): Promise<void> {
  const dir = path.dirname(getMetadataFile());
  await ensureDir(dir);

  const entries = Object.fromEntries(backups);
  const key = await getIntegrityKey();
  const integrity = computeMetadataHmac(entries, key);

  const data: StoredMetadata = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    backups: entries,
    integrity,
  };
  try {
    await writeJSON(getMetadataFile(), data, { spaces: 2 });
  } catch (error) {
    log.error('persistence', 'Error saving backup metadata', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}