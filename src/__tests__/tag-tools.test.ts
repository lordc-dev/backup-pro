import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import { listTagsTool, addTagsTool, removeTagsTool } from '../tools/tag-tools.js';
import { BackupStore } from '../utils/store.js';
import { BackupInfo, BackupMetadata } from '../types/index.js';
import { addTagsToBackup, removeTagsFromBackup, getTags, getTagStats } from '../operations/tags.js';
import { config } from '../utils/config.js';

const TMP_DIR = path.join(os.tmpdir(), `tag-tools-test-${Date.now()}`);
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

describe('addTagsToBackup', () => {
  it('adds tags to existing backup', () => {
    backups.set('b1', makeBackup({ id: 'b1', tags: ['alpha'] }));
    const result = addTagsToBackup('b1', ['beta', 'gamma'], backups);
    expect(result).toBe(true);
    const updated = backups.get('b1')!;
    expect(updated.metadata.tags).toContain('alpha');
    expect(updated.metadata.tags).toContain('beta');
    expect(updated.metadata.tags).toContain('gamma');
  });

  it('returns false for nonexistent backup', () => {
    const result = addTagsToBackup('nonexistent', ['tag'], backups);
    expect(result).toBe(false);
  });

  it('does not add duplicate tags', () => {
    backups.set('b2', makeBackup({ id: 'b2', tags: ['alpha'] }));
    addTagsToBackup('b2', ['alpha'], backups);
    const updated = backups.get('b2')!;
    expect(updated.metadata.tags.filter(t => t === 'alpha')).toHaveLength(1);
  });
});

describe('removeTagsFromBackup', () => {
  it('removes specified tags', () => {
    backups.set('b3', makeBackup({ id: 'b3', tags: ['alpha', 'beta', 'gamma'] }));
    const result = removeTagsFromBackup('b3', ['beta'], backups);
    expect(result).toBe(true);
    const updated = backups.get('b3')!;
    expect(updated.metadata.tags).not.toContain('beta');
    expect(updated.metadata.tags).toContain('alpha');
    expect(updated.metadata.tags).toContain('gamma');
  });

  it('returns false for nonexistent backup', () => {
    const result = removeTagsFromBackup('nonexistent', ['tag'], backups);
    expect(result).toBe(false);
  });

  it('handles removing tags that do not exist', () => {
    backups.set('b4', makeBackup({ id: 'b4', tags: ['alpha'] }));
    removeTagsFromBackup('b4', ['nonexistent'], backups);
    const updated = backups.get('b4')!;
    expect(updated.metadata.tags).toContain('alpha');
  });
});

describe('getTags', () => {
  it('returns all unique tags', () => {
    backups.set('b5', makeBackup({ id: 'b5', tags: ['alpha', 'beta'] }));
    backups.set('b6', makeBackup({ id: 'b6', tags: ['beta', 'gamma'] }));
    const tags = getTags(backups);
    expect(tags).toContain('alpha');
    expect(tags).toContain('beta');
    expect(tags).toContain('gamma');
  });

  it('returns tags from store', () => {
    backups.set('b5', makeBackup({ id: 'b5', tags: ['alpha', 'beta'] }));
    backups.set('b6', makeBackup({ id: 'b6', tags: ['beta', 'gamma'] }));
    const tags = getTags(backups);
    expect(tags).toContain('alpha');
    expect(tags).toContain('beta');
    expect(tags).toContain('gamma');
  });
});

describe('getTagStats', () => {
  it('counts tag occurrences', () => {
    backups.set('b7', makeBackup({ id: 'b7', tags: ['alpha', 'beta'] }));
    backups.set('b8', makeBackup({ id: 'b8', tags: ['alpha'] }));
    const stats = getTagStats(backups);
    const alphaStat = stats.find(s => s.tag === 'alpha');
    expect(alphaStat).toBeDefined();
    expect(alphaStat!.count).toBe(2);
  });

  it('sorts by count descending', () => {
    backups.set('b9', makeBackup({ id: 'b9', tags: ['rare'] }));
    backups.set('b10', makeBackup({ id: 'b10', tags: ['common', 'common2'] }));
    backups.set('b11', makeBackup({ id: 'b11', tags: ['common'] }));
    const stats = getTagStats(backups);
    if (stats.length >= 2) {
      expect(stats[0].count).toBeGreaterThanOrEqual(stats[1].count);
    }
  });
});

describe('listTagsTool', () => {
  it('returns formatted tag list', async () => {
    backups.set('t1', makeBackup({ id: 't1', tags: ['dev', 'prod'] }));
    const result = await listTagsTool.handler({}, backups);
    expect(result.text).toContain('#dev');
    expect(result.text).toContain('#prod');
    expect(result.type).toBe('text');
  });

  it('returns formatted tag list with tags present', async () => {
    backups.set('t1', makeBackup({ id: 't1', tags: ['dev', 'prod'] }));
    const result = await listTagsTool.handler({}, backups);
    expect(result.text).toContain('#dev');
    expect(result.text).toContain('#prod');
    expect(result.type).toBe('text');
  });
});

describe('addTagsTool', () => {
  it('adds tags via tool handler', async () => {
    const testFile = path.join(TMP_DIR, 'tag-add.txt');
    await fs.writeFile(testFile, 'content');
    const { createBackup } = await import('../operations/create.js');
    const { backupId } = await createBackup({ filePath: testFile, tags: ['initial'] }, backups);

    const result = await addTagsTool.handler({ backupId, tags: ['added'] }, backups);
    expect(result.text).toContain('added');
    expect(result.text).toContain(backupId);
  });

  it('throws for missing backup', async () => {
    await expect(addTagsTool.handler({ backupId: 'missing', tags: ['x'] }, backups)).rejects.toThrow();
  });
});

describe('removeTagsTool', () => {
  it('removes tags via tool handler', async () => {
    const testFile = path.join(TMP_DIR, 'tag-remove.txt');
    await fs.writeFile(testFile, 'content');
    const { createBackup } = await import('../operations/create.js');
    const { backupId } = await createBackup({ filePath: testFile, tags: ['keep', 'remove'] }, backups);

    const result = await removeTagsTool.handler({ backupId, tags: ['remove'] }, backups);
    expect(result.text).toContain('remove');
  });

  it('throws for missing backup', async () => {
    await expect(removeTagsTool.handler({ backupId: 'missing', tags: ['x'] }, backups)).rejects.toThrow();
  });
});