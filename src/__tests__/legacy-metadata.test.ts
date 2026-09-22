import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadBackupMetadata, saveBackupMetadata } from '../utils/persistence.js';
import { config } from '../utils/config.js';
import { BackupStore } from '../utils/store.js';
import { BackupInfo } from '../types/index.js';

const TMP_DIR = path.join(os.tmpdir(), `legacy-metadata-test-${Date.now()}`);
let originalBackupDir: string;

function makeBackup(id: string): BackupInfo {
  return {
    backupPath: path.join(TMP_DIR, `${id}.backup`),
    metadata: {
      id,
      originalPath: `/tmp/${id}.txt`,
      timestamp: new Date().toISOString(),
      description: `legacy ${id}`,
      tags: ['legacy'],
      size: 10,
    },
  };
}

beforeEach(async () => {
  await fs.mkdir(TMP_DIR, { recursive: true });
  originalBackupDir = config.backupDir;
  config.backupDir = TMP_DIR;
});

afterEach(async () => {
  config.backupDir = originalBackupDir;
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('legacy metadata (v1 format)', () => {
  it('loads metadata without schemaVersion (legacy v1 flat record)', async () => {
    // v1 format: the file IS the record of backups, no wrapper object
    const legacy = {
      'legacy-id-1': makeBackup('legacy-id-1').metadata,
      'legacy-id-2': makeBackup('legacy-id-2').metadata,
    };
    await fs.writeFile(path.join(TMP_DIR, 'metadata.json'), JSON.stringify(legacy));

    const { backups, loadError } = await loadBackupMetadata();
    expect(loadError).toBeUndefined();
    expect(backups.size).toBe(2);
    expect(backups.get('legacy-id-1')?.metadata.description).toBe('legacy legacy-id-1');
  });

  it('loads empty store when metadata file does not exist', async () => {
    const { backups, loadError } = await loadBackupMetadata();
    expect(loadError).toBeUndefined();
    expect(backups.size).toBe(0);
  });

  it('returns loadError for corrupted metadata JSON', async () => {
    await fs.writeFile(path.join(TMP_DIR, 'metadata.json'), '{ not valid json !!!');
    const { backups, loadError } = await loadBackupMetadata();
    expect(loadError).toBeDefined();
    expect(backups.size).toBe(0);
  });

  it('round-trips v2 format with schemaVersion and integrity', async () => {
    const store = new Map<string, BackupInfo>();
    store.set('rt-1', makeBackup('rt-1'));
    await saveBackupMetadata(store);

    const { backups, loadError, integrityWarning } = await loadBackupMetadata();
    expect(loadError).toBeUndefined();
    expect(integrityWarning).toBeUndefined();
    expect(backups.size).toBe(1);
    expect(backups.get('rt-1')?.metadata.id).toBe('rt-1');
  });

  it('detects tampered metadata via integrity HMAC', async () => {
    const store = new Map<string, BackupInfo>();
    store.set('tamper-1', makeBackup('tamper-1'));
    await saveBackupMetadata(store);

    // Tamper: modify a description directly in the file
    const metaPath = path.join(TMP_DIR, 'metadata.json');
    const raw = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    raw.backups['tamper-1'].description = 'TAMPERED';
    await fs.writeFile(metaPath, JSON.stringify(raw, null, 2));

    const { integrityWarning } = await loadBackupMetadata();
    expect(integrityWarning).toBeDefined();
    expect(integrityWarning).toContain('integrity');
  });
});

describe('BackupStore with legacy load', () => {
  it('creates a store from legacy metadata', async () => {
    const legacy = { 'store-legacy': makeBackup('store-legacy').metadata };
    await fs.writeFile(path.join(TMP_DIR, 'metadata.json'), JSON.stringify(legacy));

    const store = await BackupStore.create();
    expect(store.size).toBe(1);
    expect(store.get('store-legacy')).toBeDefined();
    store.stopAutoSave();
  });
});