import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBackup, formatBackupDetails, BackupDetails } from '../operations/get.js';
import { getBackupStats } from '../operations/stats.js';
import { verifyBackup, formatVerifyResult, VerifyResult } from '../operations/verify.js';
import { BackupStore } from '../utils/store.js';
import { BackupInfo, BackupMetadata } from '../types/index.js';

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

// ─── get.ts ────────────────────────────────────────────────────────────────

describe('getBackup', () => {
  let store: BackupStore;

  beforeEach(async () => {
    store = await BackupStore.create();
  });

  afterEach(() => {
    store.stopAutoSave();
  });

  it('throws backupNotFoundError for missing id', async () => {
    await expect(getBackup('nonexistent', store)).rejects.toThrow();
  });

  it('returns details with backupExists false when backup file missing', async () => {
    const backup = makeBackup({
      id: 'missing-backup',
      originalPath: '/tmp/nonexistent-original.txt',
      size: 200,
    });
    store.set('missing-backup', backup);
    const details = await getBackup('missing-backup', store);
    expect(details.backupExists).toBe(false);
    expect(details.originalExists).toBe(false);
    expect(details.id).toBe('missing-backup');
  });

  it('returns warnings when hash comparison fails', async () => {
    const backup = makeBackup({
      id: 'hash-fail',
      originalPath: '/tmp/hash-fail.txt',
      fileHash: 'abc123',
      size: 50,
    });
    store.set('hash-fail', backup);
    const details = await getBackup('hash-fail', store);
    expect(details.id).toBe('hash-fail');
  });

  it('computes actualSize from backup file when backupExists', async () => {
    const backup = makeBackup({
      id: 'size-test',
      originalPath: '/tmp/size-test.txt',
      size: 0,
    });
    store.set('size-test', backup);
    const details = await getBackup('size-test', store);
    expect(details).toBeDefined();
  });
});

describe('formatBackupDetails', () => {
  it('includes all optional fields', () => {
    const details: BackupDetails = {
      id: 'full-detail',
      originalPath: '/tmp/full.txt',
      timestamp: '2024-01-01T00:00:00Z',
      description: 'full desc',
      tags: ['a', 'b'],
      size: 1024,
      sizeFormatted: '1.00 KB',
      backupPath: '/tmp/backup/full.bak',
      backupExists: true,
      originalExists: true,
      hashMatch: true,
      currentSize: 2048,
      relatedFiles: ['/tmp/related1.txt'],
      projectContext: 'my-project',
      author: 'dev',
      warnings: ['watch out'],
    };
    const result = formatBackupDetails(details);
    expect(result).toContain('full-detail');
    expect(result).toContain('#a');
    expect(result).toContain('my-project');
    expect(result).toContain('dev');
    expect(result).toContain('watch out');
    expect(result).toContain('1.00 KB');
  });

  it('omits optional fields when undefined', () => {
    const details: BackupDetails = {
      id: 'minimal',
      originalPath: '/tmp/min.txt',
      timestamp: '2024-01-01T00:00:00Z',
      description: '',
      tags: [],
      size: 0,
      sizeFormatted: '0.00 B',
      backupPath: '/tmp/backup/min.bak',
      backupExists: false,
      originalExists: false,
    };
    const result = formatBackupDetails(details);
    expect(result).not.toContain('Description');
    expect(result).not.toContain('Tags');
    expect(result).not.toContain('Related');
    expect(result).not.toContain('Warnings');
  });

  it('shows missing backup and deleted original status', () => {
    const details: BackupDetails = {
      id: 'gone',
      originalPath: '/tmp/gone.txt',
      timestamp: '2024-01-01T00:00:00Z',
      description: '',
      tags: [],
      size: 100,
      sizeFormatted: '100.00 B',
      backupPath: '/tmp/backup/gone.bak',
      backupExists: false,
      originalExists: false,
    };
    const result = formatBackupDetails(details);
    expect(result).toContain('missing');
    expect(result).toContain('deleted/moved');
  });

  it('shows modified when hashMatch is false', () => {
    const details: BackupDetails = {
      id: 'mod',
      originalPath: '/tmp/mod.txt',
      timestamp: '2024-01-01T00:00:00Z',
      description: '',
      tags: [],
      size: 100,
      sizeFormatted: '100.00 B',
      backupPath: '/tmp/backup/mod.bak',
      backupExists: true,
      originalExists: true,
      hashMatch: false,
    };
    const result = formatBackupDetails(details);
    expect(result).toContain('modified');
  });
});

// ─── stats.ts ───────────────────────────────────────────────────────────────

describe('getBackupStats', () => {
  let store: BackupStore;

  beforeEach(async () => {
    store = await BackupStore.create();
  });

  afterEach(() => {
    store.stopAutoSave();
  });

  it('returns stats accounting for existing data', async () => {
    const { stats } = await getBackupStats(store);
    expect(stats.totalBackups).toBe(store.size);
    expect(stats.fileCount).toBeGreaterThanOrEqual(0);
  });

  it('computes stats with size from metadata', async () => {
    const baseSize = Array.from(store.values()).reduce((sum, b) => sum + (b.metadata.size || 0), 0);
    store.set('s1', makeBackup({ id: 's1', size: 1024, originalPath: '/tmp/a.txt', timestamp: '2023-01-01T00:00:00Z' }));
    store.set('s2', makeBackup({ id: 's2', size: 2048, originalPath: '/tmp/b.txt', timestamp: '2024-01-01T00:00:00Z' }));
    const { stats } = await getBackupStats(store);
    expect(stats.totalBackups).toBe(store.size);
    expect(stats.totalSize).toBe(baseSize + 3072);
  });

  it('tracks newest timestamp correctly', async () => {
    store.set('new', makeBackup({ id: 'new-timestamp', timestamp: '2099-01-01T00:00:00Z', originalPath: '/tmp/new-ts.txt', size: 10 }));
    const { stats } = await getBackupStats(store);
    expect(stats.newestBackup).toBe('2099-01-01T00:00:00Z');
  });

  it('counts unique files correctly with existing data', async () => {
    const { stats: before } = await getBackupStats(store);
    store.set('s1', makeBackup({ id: 's1', originalPath: '/tmp/same.txt', size: 10, timestamp: '2024-01-01T00:00:00Z' }));
    store.set('s2', makeBackup({ id: 's2', originalPath: '/tmp/same.txt', size: 20, timestamp: '2024-01-02T00:00:00Z' }));
    const { stats } = await getBackupStats(store);
    expect(stats.fileCount).toBe(before.fileCount + 1);
  });

  it('falls back to stat when size is 0 or undefined', async () => {
    store.set('nosize', makeBackup({ id: 'nosize', size: 0, originalPath: '/tmp/nosize.txt', timestamp: '2024-01-01T00:00:00Z' }));
    const { stats } = await getBackupStats(store);
    expect(stats.totalBackups).toBeGreaterThanOrEqual(1);
  });
});

// ─── verify.ts ───────────────────────────────────────────────────────────────

describe('verifyBackup', () => {
  let store: BackupStore;

  beforeEach(async () => {
    store = await BackupStore.create();
  });

  afterEach(() => {
    store.stopAutoSave();
  });

  it('throws for nonexistent backup id', async () => {
    await expect(verifyBackup('nonexistent', store)).rejects.toThrow();
  });

  it('returns missing backup result when file absent', async () => {
    const backup = makeBackup({ id: 'v-missing', originalPath: '/tmp/v-missing.txt', size: 10 });
    store.set('v-missing', backup);
    const result = await verifyBackup('v-missing', store);
    expect(result.backupExists).toBe(false);
    expect(result.message).toContain('missing');
  });

  it('returns intact when backup file matches stored hash', async () => {
    const backup = makeBackup({ id: 'v-intact', originalPath: '/tmp/v-intact.txt', size: 10 });
    store.set('v-intact', backup);
    const result = await verifyBackup('v-intact', store);
    expect(result).toBeDefined();
  });

  it('returns intact=true when no stored hash', async () => {
    const backup = makeBackup({ id: 'v-nohash', originalPath: '/tmp/v-nohash.txt', size: 10 });
    delete (backup.metadata as any).fileHash;
    store.set('v-nohash', backup);
    const result = await verifyBackup('v-nohash', store);
    expect(result).toBeDefined();
  });

  it('produces warnings on read error', async () => {
    const backup = makeBackup({ id: 'v-err', originalPath: '/tmp/v-err.txt', fileHash: 'abc', size: 10 });
    store.set('v-err', backup);
    const result = await verifyBackup('v-err', store);
    expect(result).toBeDefined();
  });
});

describe('formatVerifyResult', () => {
  it('formats missing backup message', () => {
    const result: VerifyResult = {
      backupId: 'abc',
      originalPath: '/tmp/f.txt',
      backupExists: false,
      originalExists: false,
      backupIntact: false,
      originalChanged: false,
      message: '❌ Backup file is missing!',
    };
    const text = formatVerifyResult(result);
    expect(text).toContain('missing');
  });

  it('formats intact with original deleted', () => {
    const result: VerifyResult = {
      backupId: 'abc',
      originalPath: '/tmp/f.txt',
      backupExists: true,
      originalExists: false,
      backupIntact: true,
      originalChanged: false,
      message: '✅ Backup intact | Original file deleted/moved',
    };
    const text = formatVerifyResult(result);
    expect(text).toContain('deleted/moved');
  });

  it('shows hash details when present', () => {
    const result: VerifyResult = {
      backupId: 'abc',
      originalPath: '/tmp/f.txt',
      backupExists: true,
      originalExists: true,
      storedHash: 'deadbeef',
      backupHash: 'deadbeef',
      currentHash: 'cafebabe',
      backupIntact: true,
      originalChanged: true,
      message: '✅ Backup intact | Original has been modified since backup',
    };
    const text = formatVerifyResult(result);
    expect(text).toContain('deadbeef');
    expect(text).toContain('cafebabe');
  });

  it('shows warnings', () => {
    const result: VerifyResult = {
      backupId: 'abc',
      originalPath: '/tmp/f.txt',
      backupExists: true,
      originalExists: true,
      backupIntact: true,
      originalChanged: false,
      message: '✅ Backup intact | Original unchanged',
      warnings: ['disk error'],
    };
    const text = formatVerifyResult(result);
    expect(text).toContain('disk error');
  });

  it('formats corrupted message', () => {
    const result: VerifyResult = {
      backupId: 'abc',
      originalPath: '/tmp/f.txt',
      backupExists: true,
      originalExists: true,
      backupIntact: false,
      originalChanged: false,
      message: '⚠️ Backup may be corrupted - hash mismatch',
    };
    const text = formatVerifyResult(result);
    expect(text).toContain('corrupted');
  });
});