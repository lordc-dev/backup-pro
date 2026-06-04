import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import { deleteBackup, deleteBackups } from '../operations/delete.js';
import { createBackup } from '../operations/create.js';
import { BackupStore } from '../utils/store.js';
import { BackupInfo, BackupMetadata } from '../types/index.js';
import { config } from '../utils/config.js';

const TMP_DIR = path.join(os.tmpdir(), `delete-test-${Date.now()}`);
let backups: BackupStore;
let originalAllowedRoots: string[];

function makeBackup(overrides: Partial<BackupMetadata> = {}): BackupInfo {
  const defaults: BackupMetadata = {
    id: 'test-id',
    originalPath: '/tmp/test.txt',
    timestamp: new Date().toISOString(),
    description: 'test backup',
    tags: ['test'],
    size: 100,
  };
  return {
    backupPath: `/tmp/backups/${overrides.id ?? defaults.id}.bak`,
    metadata: { ...defaults, ...overrides },
  };
}

beforeEach(async () => {
  await fs.mkdir(TMP_DIR, { recursive: true });
  originalAllowedRoots = [...config.allowedRoots];
  config.allowedRoots = [TMP_DIR, fsSync.realpathSync(os.tmpdir()), ...config.allowedRoots];
  backups = await BackupStore.create();
});

afterEach(async () => {
  config.allowedRoots = originalAllowedRoots;
  backups.stopAutoSave();
  try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
});

describe('deleteBackup', () => {
  it('deletes a backup and returns metadata', async () => {
    const testFile = path.join(TMP_DIR, 'delete-me.txt');
    await fs.writeFile(testFile, 'to be deleted');
    const { backupId } = await createBackup({ filePath: testFile }, backups);

    const result = await deleteBackup(backupId, backups);
    expect(result.success).toBe(true);
    expect(result.backupId).toBe(backupId);
    expect(result.freedSpace).toBeGreaterThanOrEqual(0);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.id).toBe(backupId);
  });

  it('removes backup from store after deletion', async () => {
    const testFile = path.join(TMP_DIR, 'delete-store.txt');
    await fs.writeFile(testFile, 'delete from store');
    const { backupId } = await createBackup({ filePath: testFile }, backups);

    await deleteBackup(backupId, backups);
    expect(backups.get(backupId)).toBeUndefined();
  });

  it('throws for nonexistent backup id', async () => {
    await expect(deleteBackup('nonexistent-id', backups)).rejects.toThrow();
  });

  it('handles missing backup file gracefully', async () => {
    const backup = makeBackup({
      id: 'missing-file',
      originalPath: path.join(TMP_DIR, 'missing.txt'),
      size: 50,
    });
    backup.backupPath = '/tmp/nonexistent-backup-file-that-does-not-exist.txt';
    backups.set('missing-file', backup);

    const result = await deleteBackup('missing-file', backups);
    expect(result.success).toBe(true);
    expect(result.freedSpace).toBe(0);
  });

  it('returns freedSpace even when stat fails', async () => {
    const backup = makeBackup({
      id: 'stat-fail',
      originalPath: path.join(TMP_DIR, 'statfail.txt'),
      size: 0,
    });
    backup.backupPath = '/tmp/also-nonexistent-backup.txt';
    backups.set('stat-fail', backup);
    const result = await deleteBackup('stat-fail', backups);
    expect(result.success).toBe(true);
    expect(typeof result.freedSpace).toBe('number');
  });
});

describe('deleteBackups', () => {
  it('deletes multiple backups', async () => {
    const f1 = path.join(TMP_DIR, 'multi-del-1.txt');
    const f2 = path.join(TMP_DIR, 'multi-del-2.txt');
    await fs.writeFile(f1, 'data1');
    await fs.writeFile(f2, 'data2');

    const r1 = await createBackup({ filePath: f1 }, backups);
    const r2 = await createBackup({ filePath: f2 }, backups);

    const result = await deleteBackups([r1.backupId, r2.backupId], backups);
    expect(result.deleted.length).toBe(2);
    expect(result.failed.length).toBe(0);
  });

  it('collects failures for nonexistent ids', async () => {
    const result = await deleteBackups(['nonexistent-1', 'nonexistent-2'], backups);
    expect(result.failed.length).toBe(2);
    expect(result.deleted.length).toBe(0);
  });

  it('continues on partial failure', async () => {
    const testFile = path.join(TMP_DIR, 'partial-del.txt');
    await fs.writeFile(testFile, 'partial');
    const { backupId } = await createBackup({ filePath: testFile }, backups);

    const result = await deleteBackups([backupId, 'nonexistent'], backups);
    expect(result.deleted.length).toBe(1);
    expect(result.failed.length).toBe(1);
  });
});