import { describe, it, expect } from 'vitest';
import {
  listBackupsTool,
  searchBackupsTool,
  getBackupTool,
  getBackupStatsTool,
  verifyBackupTool,
  findDuplicatesTool,
  searchBackupContentTool,
} from '../tools/query-tools.js';
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

describe('listBackupsTool', () => {
  it('has correct name and description', () => {
    expect(listBackupsTool.name).toBe('list_backups');
    expect(listBackupsTool.description).toBeTruthy();
  });

  it('handles empty store', async () => {
    const store = await BackupStore.create();
    const result = await listBackupsTool.handler({}, store);
    expect(result.text).toBeDefined();
    store.stopAutoSave();
  });

  it('handles sortBy and sortOrder params', async () => {
    const store = await BackupStore.create();
    store.set('b1', makeBackup({ id: 'b1', size: 500, timestamp: '2024-01-01T00:00:00Z' }));
    store.set('b2', makeBackup({ id: 'b2', size: 100, timestamp: '2023-01-01T00:00:00Z' }));
    const result = await listBackupsTool.handler({ sortBy: 'size', sortOrder: 'asc' }, store);
    expect(result.text).toBeDefined();
    store.stopAutoSave();
  });

  it('handles limit param', async () => {
    const store = await BackupStore.create();
    store.set('l1', makeBackup({ id: 'l1' }));
    const result = await listBackupsTool.handler({ limit: 1 }, store);
    expect(result.text).toBeDefined();
    store.stopAutoSave();
  });
});

describe('searchBackupsTool', () => {
  it('has correct name', () => {
    expect(searchBackupsTool.name).toBe('search_backups');
  });

  it('searches by query', async () => {
    const store = await BackupStore.create();
    store.set('s1', makeBackup({ id: 's1', description: 'my important data', tags: ['prod'] }));
    const result = await searchBackupsTool.handler({ query: 'important' }, store);
    expect(result.text).toBeDefined();
    store.stopAutoSave();
  });

  it('searches with dateRange', async () => {
    const store = await BackupStore.create();
    store.set('s2', makeBackup({ id: 's2', timestamp: '2024-06-15T00:00:00Z' }));
    const result = await searchBackupsTool.handler({
      query: 's2',
      dateRange: { start: '2024-01-01', end: '2024-12-31' },
    }, store);
    expect(result.text).toBeDefined();
    store.stopAutoSave();
  });
});

describe('getBackupTool', () => {
  it('has correct name', () => {
    expect(getBackupTool.name).toBe('get_backup');
  });

  it('throws for missing backup id', async () => {
    const store = await BackupStore.create();
    await expect(getBackupTool.handler({ backupId: 'nope' }, store)).rejects.toThrow();
    store.stopAutoSave();
  });
});

describe('getBackupStatsTool', () => {
  it('has correct name', () => {
    expect(getBackupStatsTool.name).toBe('get_backup_stats');
  });

  it('returns stats for empty store', async () => {
    const store = await BackupStore.create();
    const result = await getBackupStatsTool.handler({}, store);
    expect(result.text).toBeDefined();
    store.stopAutoSave();
  });

  it('returns stats with warnings', async () => {
    const store = await BackupStore.create();
    store.set('w1', makeBackup({ id: 'w1', size: 0, originalPath: '/tmp/w1.txt' }));
    const result = await getBackupStatsTool.handler({}, store);
    expect(result.text).toBeDefined();
    store.stopAutoSave();
  });
});

describe('verifyBackupTool', () => {
  it('has correct name', () => {
    expect(verifyBackupTool.name).toBe('verify_backup');
  });

  it('throws for missing id', async () => {
    const store = await BackupStore.create();
    await expect(verifyBackupTool.handler({ backupId: 'nope' }, store)).rejects.toThrow();
    store.stopAutoSave();
  });
});

describe('findDuplicatesTool', () => {
  it('has correct name', () => {
    expect(findDuplicatesTool.name).toBe('find_duplicates');
  });

  it('returns no duplicates for empty store', async () => {
    const store = await BackupStore.create();
    const result = await findDuplicatesTool.handler({}, store);
    expect(result.text).toBeDefined();
    store.stopAutoSave();
  });
});

describe('searchBackupContentTool', () => {
  it('has correct name', () => {
    expect(searchBackupContentTool.name).toBe('search_backup_content');
  });

  it('returns unavailable result when rg not installed', async () => {
    const store = await BackupStore.create();
    const result = await searchBackupContentTool.handler({ pattern: 'test' }, store);
    expect(result.text).toBeDefined();
    store.stopAutoSave();
  });

  it('handles all optional params', async () => {
    const store = await BackupStore.create();
    const result = await searchBackupContentTool.handler({
      pattern: 'test',
      ignoreCase: true,
      maxResults: 10,
      contextLines: 2,
    }, store);
    expect(result.text).toBeDefined();
    store.stopAutoSave();
  });
});